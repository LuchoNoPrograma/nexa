import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import pg from 'pg'

const { Client } = pg
const PAGE_SIZE = 1000
const DEFAULT_DATABASE_NAME = 'nexa_supabase_snapshot'
const SKIPPED_TABLES = new Set(['schema_migrations'])

function requireEnvironment(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Falta ${name} en el entorno.`)
  }
  return value
}

function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Identificador SQL no permitido: ${value}`)
  }
  return `"${value.replaceAll('"', '""')}"`
}

function localDatabaseUrls() {
  const configuredUrl = new URL(requireEnvironment('DATABASE_URL'))
  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1'])

  if (!allowedHosts.has(configuredUrl.hostname)) {
    throw new Error('DATABASE_URL debe apuntar a PostgreSQL local. No se modificó ninguna base remota.')
  }

  const databaseName = process.env.SNAPSHOT_DATABASE_NAME?.trim() || DEFAULT_DATABASE_NAME
  if (!/^[a-z_][a-z0-9_]*$/i.test(databaseName)) {
    throw new Error('SNAPSHOT_DATABASE_NAME no es un nombre de base válido.')
  }

  const targetUrl = new URL(configuredUrl)
  targetUrl.pathname = `/${databaseName}`
  const adminUrl = new URL(configuredUrl)
  adminUrl.pathname = '/postgres'

  return { adminUrl: adminUrl.toString(), databaseName, targetUrl: targetUrl.toString() }
}

async function ensureLocalDatabase(adminUrl, databaseName) {
  const client = new Client({ connectionString: adminUrl })
  await client.connect()
  try {
    const existing = await client.query('select 1 from pg_database where datname = $1', [databaseName])
    if (!existing.rowCount) {
      await client.query(`create database ${quoteIdentifier(databaseName)}`)
    }
  } finally {
    await client.end()
  }
}

function migrateLocalDatabase(targetUrl) {
  const dbmate = path.join(process.cwd(), 'node_modules', '.bin', 'dbmate')
  execFileSync(dbmate, ['--migrations-dir', 'database/local', '--no-dump-schema', 'migrate'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: targetUrl },
    stdio: 'inherit',
  })
}

async function discoverTables(supabaseUrl, headers) {
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: { ...headers, Accept: 'application/openapi+json' },
  })
  if (!response.ok) {
    throw new Error(`No se pudo leer el esquema de Supabase (${response.status}).`)
  }

  const document = await response.json()
  return Object.keys(document.paths ?? {})
    .filter(route => /^\/[a-z_][a-z0-9_]*$/i.test(route))
    .map(route => route.slice(1))
    .filter(table => !SKIPPED_TABLES.has(table))
    .sort()
}

async function fetchTable(supabaseUrl, headers, table) {
  const rows = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = new URLSearchParams({ select: '*', limit: String(PAGE_SIZE), offset: String(offset) })
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers })
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`No se pudo respaldar ${table} (${response.status}): ${detail.slice(0, 300)}`)
    }

    const page = await response.json()
    rows.push(...page)
    if (page.length < PAGE_SIZE) {
      return rows
    }
  }
}

async function createSnapshot(supabaseUrl, serviceKey) {
  const headers = {
    apikey: serviceKey,
  }
  if (serviceKey.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${serviceKey}`
  }
  const tables = await discoverTables(supabaseUrl, headers)
  const data = {}

  for (const table of tables) {
    data[table] = await fetchTable(supabaseUrl, headers, table)
    process.stdout.write(`Respaldada ${table}: ${data[table].length} filas\n`)
  }

  return {
    format: 'nexa-supabase-rest-snapshot-v1',
    createdAt: new Date().toISOString(),
    source: new URL(supabaseUrl).host,
    tables: data,
  }
}

async function saveSnapshot(snapshot) {
  const backupDir = path.join(process.cwd(), 'database', 'backups')
  const stamp = snapshot.createdAt.replaceAll(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  const backupPath = path.join(backupDir, `supabase-${stamp}.json`)

  await mkdir(backupDir, { recursive: true })
  await writeFile(backupPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 })
  return backupPath
}

async function localTables(client) {
  const result = await client.query(`
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename <> 'schema_migrations'
    order by tablename
  `)
  return result.rows.map(row => row.tablename)
}

async function localJsonColumns(client) {
  const result = await client.query(`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and data_type in ('json', 'jsonb')
  `)
  const columnsByTable = new Map()

  for (const row of result.rows) {
    const columns = columnsByTable.get(row.table_name) ?? new Set()
    columns.add(row.column_name)
    columnsByTable.set(row.table_name, columns)
  }

  return columnsByTable
}

async function insertRows(client, table, rows, jsonColumns) {
  if (!rows.length) {
    return
  }

  const columns = Object.keys(rows[0])
  const quotedColumns = columns.map(quoteIdentifier).join(', ')
  const batchSize = Math.max(1, Math.min(200, Math.floor(50_000 / columns.length)))

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize)
    const values = []
    const tuples = batch.map((row) => {
      const placeholders = columns.map((column) => {
        const value = row[column]
        values.push(value !== null && jsonColumns.has(column) ? JSON.stringify(value) : value)
        return `$${values.length}`
      })
      return `(${placeholders.join(', ')})`
    })

    await client.query(
      `insert into ${quoteIdentifier(table)} (${quotedColumns}) values ${tuples.join(', ')}`,
      values,
    )
  }
}

async function restoreSnapshot(targetUrl, snapshot) {
  const client = new Client({ connectionString: targetUrl })
  await client.connect()

  try {
    await client.query('begin')
    await client.query('set local session_replication_role = replica')

    const availableTables = await localTables(client)
    const jsonColumns = await localJsonColumns(client)
    if (availableTables.length) {
      const tablesSql = availableTables.map(quoteIdentifier).join(', ')
      await client.query(`truncate table ${tablesSql} restart identity cascade`)
    }

    for (const [table, rows] of Object.entries(snapshot.tables)) {
      if (!availableTables.includes(table)) {
        process.stdout.write(`Omitida ${table}: no existe en el esquema local.\n`)
        continue
      }
      await insertRows(client, table, rows, jsonColumns.get(table) ?? new Set())
      process.stdout.write(`Restaurada ${table}: ${rows.length} filas\n`)
    }

    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.end()
  }
}

async function main() {
  const supabaseUrl = requireEnvironment('SUPABASE_URL').replace(/\/$/, '')
  const serviceKey = requireEnvironment('SUPABASE_SECRET_KEY')
  const { adminUrl, databaseName, targetUrl } = localDatabaseUrls()

  process.stdout.write(`Creando respaldo de Supabase para ${databaseName}...\n`)
  const snapshot = await createSnapshot(supabaseUrl, serviceKey)
  const backupPath = await saveSnapshot(snapshot)

  await ensureLocalDatabase(adminUrl, databaseName)
  migrateLocalDatabase(targetUrl)
  await restoreSnapshot(targetUrl, snapshot)

  const totalRows = Object.values(snapshot.tables).reduce((sum, rows) => sum + rows.length, 0)
  process.stdout.write(`\nRespaldo listo: ${backupPath}\n`)
  process.stdout.write(`Base local lista: ${databaseName} (${totalRows} filas)\n`)
  process.stdout.write('Para usarla sin mostrar credenciales: npm run dev:snapshot\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
