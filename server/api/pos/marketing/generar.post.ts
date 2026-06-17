import process from 'node:process'
import { createError, readBody } from 'h3'
import { ensureDatabase, pool } from '../../../utils/db'
import { requireStoreAccess } from '../../../utils/posCatalog'
import type { MarketingPublicacion } from '~~/shared/utils/marketing'

// Objetivo elegido por el usuario antes de generar. Cada modo decide qué
// productos saca de la base de datos y cómo se arma el texto.
type Modo = 'clientes' | 'sobrante' | 'combo' | 'producto'

type GenerarBody = {
  modo?: string
  productoId?: string | null
  productoIds?: string[] | null
  nota?: string | null
}

type ProductoContexto = {
  id: string
  nombre: string
  categoria: string | null
  precio: number
  stock: number
  descripcion: string | null
  imagenUrl: string | null
}

type TiendaContexto = {
  nombre: string
  rubro: string | null
  ciudad: string
}

type PostGenerado = {
  titulo: string
  texto: string
  hashtags: string[]
  ideaVideo: string
  mejorHora: string
  audiencia: string
  objetivo: string
  impacto: number
}

type GeminiResponse = {
  candidates?: Array<{
    finishReason?: string
    content?: { parts?: Array<{ text?: string }> }
  }>
}

const MODOS_VALIDOS: Modo[] = ['clientes', 'sobrante', 'combo', 'producto']

const SELECT_PRODUCTO = `
  p.id,
  p.nombre,
  c.nombre as categoria,
  p.precio_venta::float as precio,
  p.stock_actual::float as stock,
  p.descripcion,
  p.imagen_url as "imagenUrl"
`

function clampImpacto(value: unknown): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) {
    return 4
  }
  return Math.min(5, Math.max(1, n))
}

function limpiarTexto(value: unknown, max: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function normalizarHashtags(value: unknown): string[] {
  const lista = Array.isArray(value) ? value : []
  return lista
    .map((item) => {
      const tag = String(item ?? '').trim().replace(/\s+/g, '')
      if (!tag) {
        return ''
      }
      return tag.startsWith('#') ? tag : `#${tag}`
    })
    .filter(Boolean)
    .slice(0, 5)
}

// --- Selección de productos según el objetivo (trabaja con la base de datos) ---

async function pickProductos(
  storeId: string,
  modo: Modo,
  productoId: string | null,
  productoIds: string[],
): Promise<ProductoContexto[]> {
  // Producto específico elegido por el usuario.
  if (modo === 'producto') {
    if (!productoId) {
      return []
    }
    const result = await pool.query<ProductoContexto>(
      `select ${SELECT_PRODUCTO}
       from producto p
       left join categoria c on c.id = p.categoria_id
       where p.id = $1 and p.tienda_id = $2 and p.activo = true
       limit 1`,
      [productoId, storeId],
    )
    return result.rows
  }

  // Combo: los productos que el usuario eligió (máximo 4).
  if (modo === 'combo') {
    const ids = productoIds.filter(Boolean).slice(0, 4)
    if (ids.length < 2) {
      return []
    }
    const result = await pool.query<ProductoContexto>(
      `select ${SELECT_PRODUCTO}
       from producto p
       left join categoria c on c.id = p.categoria_id
       where p.id = any($1::uuid[]) and p.tienda_id = $2 and p.activo = true and p.tipo = 'producto'`,
      [ids, storeId],
    )
    return result.rows
  }

  // Sobrante: el producto con más stock acumulado (lo que más sobra).
  if (modo === 'sobrante') {
    const result = await pool.query<ProductoContexto>(
      `select ${SELECT_PRODUCTO}
       from producto p
       left join categoria c on c.id = p.categoria_id
       where p.tienda_id = $1 and p.activo = true and p.tipo = 'producto' and p.stock_actual > 0
       order by p.stock_actual desc
       limit 1`,
      [storeId],
    )
    return result.rows
  }

  // Atraer clientes: un producto al azar, evitando repetir el último sugerido.
  const result = await pool.query<ProductoContexto>(
    `select ${SELECT_PRODUCTO}
     from producto p
     left join categoria c on c.id = p.categoria_id
     where p.tienda_id = $1 and p.activo = true and p.tipo = 'producto'
     order by
       (p.id = (
         select producto_id from marketing_publicacion
         where tienda_id = $1 order by created_at desc limit 1
       )) asc,
       random()
     limit 1`,
    [storeId],
  )
  return result.rows
}

// --- Construcción del prompt según el objetivo ---

function pistaModo(modo: Modo): string {
  switch (modo) {
    case 'sobrante':
      return 'Tengo bastante stock de este producto y quiero que salga rápido. Propón una oferta o promoción atractiva (descuento, 2x1, precio especial).'
    case 'clientes':
      return 'Quiero atraer clientes nuevos con este producto.'
    case 'producto':
    default:
      return 'Quiero promocionar este producto.'
  }
}

function buildPrompt(modo: Modo, productos: ProductoContexto[], tienda: TiendaContexto, nota: string): string {
  const cabecera = `Negocio: ${tienda.nombre}${tienda.rubro ? ` (${tienda.rubro})` : ''}, en ${tienda.ciudad}.`
  const pistaNota = nota ? `Indicación del dueño del negocio (tenla muy en cuenta): "${nota}".` : ''

  const esquemaJson = [
    'Devuelve este JSON exacto:',
    '{',
    '  "titulo": "nombre corto y atractivo",',
    '  "texto": "la publicación lista para copiar (máx 220 caracteres, simple, 1-2 emojis)",',
    '  "hashtags": ["3 a 5 hashtags, cada uno UNA sola idea: marca, producto/rubro, ciudad y comunidad"],',
    '  "ideaVideo": "una sola frase con una idea sencilla de video",',
    '  "mejorHora": "hora sugerida para publicar en formato HH:MM",',
    '  "audiencia": "a quién le interesa, en pocas palabras",',
    '  "objetivo": "qué busca esta publicación, en pocas palabras",',
    '  "impacto": 4',
    '}',
  ].join('\n')

  if (modo === 'combo') {
    const total = productos.reduce((sum, p) => sum + p.precio, 0)
    const sugerido = Math.max(1, Math.round(total * 0.9))
    return [
      cabecera,
      'Quiero armar un combo o promoción juntando estos productos:',
      ...productos.map((p) => `- ${p.nombre} (Bs ${p.precio})${p.categoria ? ` · ${p.categoria}` : ''}`),
      `Precio sumado: Bs ${total}. Puedes sugerir un precio especial alrededor de Bs ${sugerido}.`,
      'Ponle un nombre llamativo al combo y, en el texto, deja claro por qué estos productos combinan bien juntos (se complementan, son perfectos para una ocasión o momento del día).',
      'Anímalos a llevar todo junto resaltando el ahorro frente a comprarlos por separado.',
      pistaNota,
      '',
      esquemaJson,
    ].filter(Boolean).join('\n')
  }

  const producto = productos[0]!
  return [
    cabecera,
    `Producto a promocionar: ${producto.nombre}.`,
    producto.categoria ? `Categoría: ${producto.categoria}.` : '',
    `Precio: Bs ${producto.precio}.`,
    producto.descripcion ? `Descripción: ${producto.descripcion}.` : '',
    pistaModo(modo),
    pistaNota,
    '',
    esquemaJson,
  ].filter(Boolean).join('\n')
}

// --- Respaldo sin IA (usa datos reales del producto) ---

// Convierte un texto en un hashtag en PascalCase, sin tildes, espacios ni símbolos.
function aHashtag(texto: string): string {
  const limpio = String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes (marcas diacríticas)
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
  if (!limpio) {
    return ''
  }
  const pascal = limpio.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  return `#${pascal}`
}

// Mezcla recomendada por marketeros: marca + producto/rubro + ciudad + comunidad,
// cada hashtag con una sola idea (nunca pegar conceptos como #ProductoCiudad).
function hashtagsDemo(modo: Modo, productos: ProductoContexto[], tienda: TiendaContexto): string[] {
  const marca = aHashtag(tienda.nombre)
  const ciudad = aHashtag(tienda.ciudad || 'Cobija')
  const producto = modo === 'combo'
    ? '#Combo'
    : aHashtag(productos[0]?.categoria || productos[0]?.nombre || 'Oferta')
  const intencion = modo === 'sobrante' || modo === 'combo' ? '#OfertasBolivia' : '#ComproLocal'
  const comunidad = '#EmprendimientoBoliviano'
  return [...new Set([marca, producto, ciudad, intencion, comunidad].filter(Boolean))].slice(0, 5)
}

function buildDemoPost(modo: Modo, productos: ProductoContexto[], tienda: TiendaContexto): PostGenerado {
  if (modo === 'combo') {
    const total = productos.reduce((sum, p) => sum + p.precio, 0)
    const sugerido = Math.max(1, Math.round(total * 0.9))
    const nombres = productos.map((p) => p.nombre).join(' + ')
    return {
      titulo: 'Combo especial',
      texto: `🎉 ¡Combo especial! Llévate ${nombres} junto por solo Bs ${sugerido}. Aprovecha hoy.`,
      hashtags: hashtagsDemo(modo, productos, tienda),
      ideaVideo: 'Muestra los productos del combo juntos sobre la mesa.',
      mejorHora: '19:00',
      audiencia: 'Clientes que buscan ahorrar',
      objetivo: 'Vender más en una sola compra',
      impacto: 4,
    }
  }

  const p = productos[0]!
  if (modo === 'sobrante') {
    return {
      titulo: p.nombre,
      texto: `🔥 ¡Oferta en ${p.nombre}! Aprovecha el precio especial de Bs ${p.precio}. Pocas unidades, pásate hoy.`,
      hashtags: hashtagsDemo(modo, productos, tienda),
      ideaVideo: `Graba un video corto mostrando tu ${p.nombre} con el cartel de oferta.`,
      mejorHora: '19:00',
      audiencia: 'Clientes que buscan ofertas',
      objetivo: 'Sacar el stock que sobra',
      impacto: 4,
    }
  }

  return {
    titulo: p.nombre,
    texto: `¡${p.nombre} disponible hoy! 😋 Pásate y pídelo, te va a encantar. Precio: Bs ${p.precio}.`,
    hashtags: hashtagsDemo(modo, productos, tienda),
    ideaVideo: `Graba un video corto mostrando tu ${p.nombre} de cerca, que se vea apetitoso.`,
    mejorHora: '19:00',
    audiencia: 'Clientes cercanos a tu negocio',
    objetivo: 'Atraer más clientes',
    impacto: 4,
  }
}

async function generarConGemini(prompt: string): Promise<PostGenerado | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash'

  if (!apiKey || apiKey === 'pon-tu-api-key-de-gemini') {
    return null
  }

  const systemInstruction = [
    'Eres Haru, marketero profesional de NEXA que ayuda a pequeños negocios de Bolivia a vender más por redes sociales (Facebook, Instagram, TikTok, WhatsApp).',
    'Tu público objetivo son personas jóvenes de 15 a 40 años en Bolivia: escribe cercano, fresco y con la forma de hablar boliviana, sin caer en exceso de modismos.',
    'Aplica técnicas de venta reales: arranca con un GANCHO fuerte en la primera frase (pregunta, antojo o beneficio), muestra el PRECIO como una oportunidad ("solo Bs X", "llévalo por Bs X") y cierra con una LLAMADA A LA ACCIÓN clara (escríbenos, pásate hoy, pídelo ya).',
    'Si es una oferta o combo, resalta el ahorro o lo limitado para crear urgencia (hoy, pocas unidades, solo esta semana).',
    'Escribe para que se lea fácil en el celular: frases cortas, directas y sin palabras técnicas ni rebuscadas.',
    'El texto debe ser breve y fácil de leer (entre 140 y 280 caracteres) y usar 1 o 2 emojis que peguen con el producto, no de relleno.',
    'No inventes datos del producto: usa solo el nombre, precio y descripción que te doy. Nunca inventes precios.',
    'HASHTAGS (importante): devuelve de 3 a 5, cada uno con UNA sola idea y en PascalCase. Nunca pegues dos conceptos en una misma etiqueta (MAL: #NavidadCobija, #AbarrotesCobija; BIEN: #Navidad #Cobija #Abarrotes).',
    'Combina estos tipos: 1) de MARCA: el nombre del negocio sin espacios; 2) de PRODUCTO o RUBRO: lo que se promociona (ej. #Combo, #Abarrotes, el producto); 3) LOCAL: la ciudad o zona por separado (ej. #Cobija, #Pando); 4) de COMUNIDAD o intención de compra boliviana (ej. #ComproLocal, #EmprendimientoBoliviano, #OfertasBolivia).',
    'Usa términos que la gente realmente busca; nada de relleno genérico ni repetir la ciudad en cada etiqueta.',
    'Responde SOLO con un objeto JSON válido, sin texto adicional ni explicaciones.',
  ].join('\n')

  // Pide la respuesta a Gemini. Desactiva el "pensamiento" del modelo para que no
  // gaste tokens razonando y deje el JSON incompleto (causa del error de parseo).
  async function pedir(disableThinking: boolean): Promise<GeminiResponse | null> {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.85,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    }
    if (disableThinking) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig,
        }),
      },
    )

    if (!response.ok) {
      // Algunos modelos rechazan thinkingConfig: reintenta sin él.
      if (disableThinking && response.status === 400) {
        return pedir(false)
      }
      console.error('[marketing:gemini:error]', {
        status: response.status,
        bodyPreview: (await response.text().catch(() => '')).slice(0, 400),
      })
      return null
    }

    return await response.json() as GeminiResponse
  }

  const data = await pedir(true)
  if (!data) {
    return null
  }

  const finishReason = data.candidates?.[0]?.finishReason ?? null
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? ''

  if (!raw) {
    console.error('[marketing:gemini:empty]', { finishReason })
    return null
  }

  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim())
    const texto = limpiarTexto(parsed.texto, 400)
    if (!texto) {
      return null
    }
    return {
      titulo: limpiarTexto(parsed.titulo, 80),
      texto,
      hashtags: normalizarHashtags(parsed.hashtags),
      ideaVideo: limpiarTexto(parsed.ideaVideo, 200),
      mejorHora: limpiarTexto(parsed.mejorHora, 10) || '19:00',
      audiencia: limpiarTexto(parsed.audiencia, 80),
      objetivo: limpiarTexto(parsed.objetivo, 80),
      impacto: clampImpacto(parsed.impacto),
    }
  } catch (error) {
    console.error('[marketing:gemini:parse]', error)
    return null
  }
}

export default defineEventHandler(async (event) => {
  const session = await requireStoreAccess(event, 'haru.usar')
  await ensureDatabase()

  const body = await readBody<GenerarBody | null>(event)
  const modo: Modo = MODOS_VALIDOS.includes(body?.modo as Modo) ? (body!.modo as Modo) : 'clientes'
  const productoIds = Array.isArray(body?.productoIds) ? body!.productoIds!.map(String) : []
  const nota = String(body?.nota ?? '').replace(/\s+/g, ' ').trim().slice(0, 240)

  // El combo necesita al menos 2 productos elegidos por el usuario.
  if (modo === 'combo' && productoIds.filter(Boolean).length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Elige al menos 2 productos para armar el combo.' })
  }

  const productos = await pickProductos(session.storeId, modo, body?.productoId ?? null, productoIds)

  if (!productos.length) {
    throw createError({
      statusCode: 400,
      statusMessage: modo === 'producto'
        ? 'No se encontró ese producto en tu inventario.'
        : modo === 'combo'
          ? 'No se encontraron los productos elegidos para el combo.'
          : 'Agrega al menos un producto en tu inventario para que Haru cree una publicación.',
    })
  }

  const tiendaResult = await pool.query<TiendaContexto>(
    `select nombre, rubro, ciudad from tienda where id = $1 limit 1`,
    [session.storeId],
  )
  const tienda = tiendaResult.rows[0] ?? { nombre: session.store, rubro: null, ciudad: 'Cobija' }

  const prompt = buildPrompt(modo, productos, tienda, nota)
  const generado = await generarConGemini(prompt)
  const post = generado ?? buildDemoPost(modo, productos, tienda)

  // Para combos guardamos el producto principal + el nombre combinado.
  const principal = productos[0]!
  const productoNombre = modo === 'combo'
    ? productos.map((p) => p.nombre).join(' + ')
    : principal.nombre
  const titulo = post.titulo || productoNombre

  const client = await pool.connect()
  try {
    await client.query('begin')

    await client.query(
      `update marketing_publicacion set estado = 'descartada', updated_at = now()
       where tienda_id = $1 and estado = 'sugerida'`,
      [session.storeId],
    )

    const inserted = await client.query<MarketingPublicacion>(
      `
        insert into marketing_publicacion (
          tienda_id, usuario_id, producto_id, producto_nombre,
          titulo, texto, hashtags, idea_video, mejor_hora,
          audiencia, objetivo, impacto, imagen_url
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13)
        returning
          id,
          producto_id as "productoId",
          producto_nombre as "productoNombre",
          titulo,
          texto,
          coalesce(hashtags, '[]'::jsonb) as hashtags,
          idea_video as "ideaVideo",
          mejor_hora as "mejorHora",
          audiencia,
          objetivo,
          impacto,
          imagen_url as "imagenUrl",
          estado,
          publicado_at as "publicadoAt",
          created_at as "createdAt"
      `,
      [
        session.storeId,
        session.id,
        principal.id,
        productoNombre,
        titulo,
        post.texto,
        JSON.stringify(post.hashtags),
        post.ideaVideo,
        post.mejorHora,
        post.audiencia,
        post.objetivo,
        post.impacto,
        principal.imagenUrl,
      ],
    )

    await client.query('commit')
    return { actual: inserted.rows[0] }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
})
