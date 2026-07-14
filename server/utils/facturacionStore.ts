// Acceso a datos del modulo de facturacion SIAT.
import process from 'node:process'
import type pg from 'pg'
import { createError } from 'h3'
import type { FacturacionConfig } from '../../shared/utils/facturacion'
import { pool } from './db'
import { decryptSecret, encryptSecret, isEncryptedSecret } from './secrets'

type Queryable = pg.Pool | pg.PoolClient

export function requireSiatPilotEnabled() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXA_ENABLE_SIAT_PILOT !== 'true') {
    throw createError({
      statusCode: 503,
      statusMessage: 'La facturacion SIAT esta deshabilitada hasta completar la certificacion del piloto.',
    })
  }
}

export type FacturacionConfigRow = FacturacionConfig & {
  id: string
  tiendaId: string
  cuisVigencia: string | null
}

function mapConfig(row: Record<string, unknown>): FacturacionConfigRow {
  return {
    id: row.id as string,
    tiendaId: row.tienda_id as string,
    nit: row.nit as string,
    razonSocial: row.razon_social as string,
    municipio: (row.municipio as string) ?? null,
    telefono: (row.telefono as string) ?? null,
    direccion: (row.direccion as string) ?? null,
    modalidad: Number(row.modalidad),
    ambiente: Number(row.ambiente),
    codigoSistema: (row.codigo_sistema as string) ?? null,
    codigoSucursal: Number(row.codigo_sucursal),
    codigoPuntoVenta: Number(row.codigo_punto_venta),
    codigoActividad: (row.codigo_actividad as string) ?? null,
    codigoDocumentoSector: Number(row.codigo_documento_sector),
    tokenDelegado: decryptSecret((row.token_delegado as string) ?? null),
    cuis: (row.cuis as string) ?? null,
    cuisVigencia: (row.cuis_vigencia as string) ?? null,
    estado: row.estado as string,
  }
}

export async function getFacturacionConfig(db: Queryable, tiendaId: string) {
  const result = await db.query(
    'select * from facturacion_config where tienda_id = $1 limit 1',
    [tiendaId],
  )

  const row = result.rows[0]
  const legacyToken = row?.token_delegado as string | null | undefined
  if (row && legacyToken && !isEncryptedSecret(legacyToken)) {
    row.token_delegado = encryptSecret(legacyToken)
    await db.query(
      'update facturacion_config set token_delegado = $2, updated_at = now() where id = $1',
      [row.id, row.token_delegado],
    )
  }

  return row ? mapConfig(row) : null
}

export async function requireFacturacionConfig(db: Queryable, tiendaId: string) {
  requireSiatPilotEnabled()
  const config = await getFacturacionConfig(db, tiendaId)

  if (!config) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Configura primero los datos de facturacion (NIT, sistema y token del SIN).',
    })
  }

  return config
}

export type CufdRow = {
  id: string
  codigo: string
  codigoControl: string
  direccion: string | null
  fechaVigencia: string
}

export async function getCufdVigente(db: Queryable, configId: string): Promise<CufdRow | null> {
  const result = await db.query(
    `
      select id, codigo, codigo_control, direccion, fecha_vigencia
      from facturacion_cufd
      where config_id = $1
        and fecha_vigencia > now()
      order by fecha_vigencia desc
      limit 1
    `,
    [configId],
  )

  const row = result.rows[0]

  if (!row) {
    return null
  }

  return {
    id: row.id,
    codigo: row.codigo,
    codigoControl: row.codigo_control,
    direccion: row.direccion,
    fechaVigencia: row.fecha_vigencia,
  }
}

export async function siguienteNumeroFactura(db: Queryable, configId: string): Promise<number> {
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [configId])
  const result = await db.query<{ siguiente: string }>(
    'select coalesce(max(numero_factura), 0) + 1 as siguiente from factura where config_id = $1',
    [configId],
  )

  return Number(result.rows[0]?.siguiente ?? 1)
}

export { pool }
