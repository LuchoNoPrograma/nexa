import { createError, readBody } from 'h3'
import { SIAT_AMBIENTE, SIAT_MODALIDAD, esNitValido } from '../../../../shared/utils/facturacion'
import { ensureDatabase, pool } from '../../../utils/db'
import { cleanText, nullableText, numberOrZero, requireStoreAccess } from '../../../utils/posCatalog'
import { requireSiatPilotEnabled } from '../../../utils/facturacionStore'
import { encryptSecret } from '../../../utils/secrets'

type ConfigBody = {
  nit?: string
  razonSocial?: string
  municipio?: string
  telefono?: string
  direccion?: string
  modalidad?: number
  ambiente?: number
  codigoSistema?: string
  codigoSucursal?: number
  codigoPuntoVenta?: number
  codigoActividad?: string
  tokenDelegado?: string
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'configuracion.gestionar')
  await ensureDatabase()
  requireSiatPilotEnabled()

  const body = await readBody<ConfigBody>(event)
  const nit = cleanText(body.nit)
  const razonSocial = cleanText(body.razonSocial)

  if (!esNitValido(nit)) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa un NIT valido.' })
  }

  if (!razonSocial) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa la razon social del negocio.' })
  }

  const modalidad = Number(body.modalidad ?? SIAT_MODALIDAD.computarizada)
  const ambiente = Number(body.ambiente ?? SIAT_AMBIENTE.pruebas)
  const tokenDelegado = nullableText(body.tokenDelegado)

  if (![SIAT_MODALIDAD.electronica, SIAT_MODALIDAD.computarizada].includes(modalidad as 1 | 2)) {
    throw createError({ statusCode: 400, statusMessage: 'Modalidad de facturacion invalida.' })
  }

  if (modalidad === SIAT_MODALIDAD.electronica) {
    throw createError({
      statusCode: 501,
      statusMessage: 'La modalidad electronica requiere firma XMLDSig y aun no esta habilitada. Usa la modalidad computarizada del piloto.',
    })
  }

  if (![SIAT_AMBIENTE.produccion, SIAT_AMBIENTE.pruebas].includes(ambiente as 1 | 2)) {
    throw createError({ statusCode: 400, statusMessage: 'Ambiente SIAT invalido.' })
  }

  const result = await pool.query<{ id: string }>(
    `
      insert into facturacion_config (
        tienda_id, nit, razon_social, municipio, telefono, direccion,
        modalidad, ambiente, codigo_sistema, codigo_sucursal, codigo_punto_venta,
        codigo_actividad, token_delegado
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      on conflict (tienda_id) do update
      set
        nit = excluded.nit,
        razon_social = excluded.razon_social,
        municipio = excluded.municipio,
        telefono = excluded.telefono,
        direccion = excluded.direccion,
        modalidad = excluded.modalidad,
        ambiente = excluded.ambiente,
        codigo_sistema = excluded.codigo_sistema,
        codigo_sucursal = excluded.codigo_sucursal,
        codigo_punto_venta = excluded.codigo_punto_venta,
        codigo_actividad = excluded.codigo_actividad,
        token_delegado = coalesce(excluded.token_delegado, facturacion_config.token_delegado),
        updated_at = now()
      returning id
    `,
    [
      session.storeId,
      nit,
      razonSocial,
      nullableText(body.municipio),
      nullableText(body.telefono),
      nullableText(body.direccion),
      modalidad,
      ambiente,
      nullableText(body.codigoSistema),
      numberOrZero(body.codigoSucursal),
      numberOrZero(body.codigoPuntoVenta),
      nullableText(body.codigoActividad),
      tokenDelegado ? encryptSecret(tokenDelegado) : null,
    ],
  )

  return { ok: true, configId: result.rows[0]?.id }
})
