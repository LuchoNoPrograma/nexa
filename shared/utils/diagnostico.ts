// Cerebro del Diagnóstico rápido NEXA.
// Módulo puro (sin Vue/Nitro) compartido por la página (cliente) y la API (servidor).
// - PREGUNTAS_DIAGNOSTICO: catálogo fijo de 10 preguntas en 5 pasos.
// - calcularDiagnostico(): convierte las respuestas en scores por área, nivel,
//   problemas detectados y recomendaciones. Es la única fuente de verdad del puntaje.

export type DiagnosticoArea = 'ventas' | 'finanzas' | 'marketing' | 'inventario'

export type DiagnosticoOpcion = {
  value: string
  label: string
  // Puntos 0..100 para las preguntas que puntúan. Las preguntas de segmentación
  // (rubro, problema principal) no llevan puntos.
  puntos?: number
  // Marca la opción "No aplica" de inventario: excluye esa área del promedio.
  noAplica?: boolean
}

export type DiagnosticoPregunta = {
  id: string
  paso: number
  area?: DiagnosticoArea
  titulo: string
  // Mensaje cálido del jaguar para acompañar la pregunta.
  ayuda?: string
  opciones: DiagnosticoOpcion[]
}

export type DiagnosticoPaso = {
  numero: number
  titulo: string
  subtitulo: string
  icono: string
}

export type DiagnosticoRespuestas = Record<string, string>

export type DiagnosticoResultado = {
  saludGeneral: number
  nivel: 'bajo' | 'medio' | 'alto'
  areas: {
    ventas: number
    finanzas: number
    marketing: number
    inventario: number | null
  }
  problemas: string[]
  recomendaciones: string[]
  mensajeNivel: string
  recomendacionPrincipal: string
  rubro: string | null
  canalPrincipal: string | null
  problemaPrincipal: string | null
  version: number
}

export const DIAGNOSTICO_VERSION = 1

export const PASOS_DIAGNOSTICO: DiagnosticoPaso[] = [
  { numero: 1, titulo: 'Conociendo tu negocio', subtitulo: 'Cuéntanos lo básico', icono: 'pi pi-shop' },
  { numero: 2, titulo: 'Ventas y finanzas', subtitulo: 'Tu dinero y tus ventas', icono: 'pi pi-dollar' },
  { numero: 3, titulo: 'Marketing digital', subtitulo: 'Cómo te das a conocer', icono: 'pi pi-megaphone' },
  { numero: 4, titulo: 'Inventario e insumos', subtitulo: 'Tus productos y materia prima', icono: 'pi pi-box' },
  { numero: 5, titulo: 'Organización', subtitulo: 'Tu mayor reto hoy', icono: 'pi pi-compass' },
]

export const PREGUNTAS_DIAGNOSTICO: DiagnosticoPregunta[] = [
  {
    id: 'q1',
    paso: 1,
    titulo: '¿A qué se dedica principalmente tu negocio?',
    ayuda: 'No hay respuestas buenas o malas, esto nos ayuda a entender tu rubro.',
    opciones: [
      { value: 'comida', label: 'Venta de comida o bebidas' },
      { value: 'tienda', label: 'Tienda de productos' },
      { value: 'servicios', label: 'Servicios' },
      { value: 'belleza', label: 'Belleza o cuidado personal' },
      { value: 'artesania', label: 'Artesanías o productos locales' },
      { value: 'otro', label: 'Otro' },
    ],
  },
  {
    id: 'q2',
    paso: 1,
    area: 'ventas',
    titulo: '¿Cómo atiendes actualmente a tus compradores?',
    ayuda: 'Piensa en cómo te compran la mayoría de tus clientes.',
    opciones: [
      { value: 'presencial_digital', label: 'Presencial y digital', puntos: 100 },
      { value: 'delivery', label: 'Por delivery o pedidos', puntos: 80 },
      { value: 'redes', label: 'Solo por redes o WhatsApp', puntos: 60 },
      { value: 'presencial', label: 'Solo presencial', puntos: 40 },
      { value: 'empezando', label: 'Aún estoy empezando', puntos: 20 },
    ],
  },
  {
    id: 'q3',
    paso: 2,
    area: 'ventas',
    titulo: '¿Registras tus ventas diariamente?',
    ayuda: 'Puedes responder con aproximados, no necesitas datos exactos.',
    opciones: [
      { value: 'todos_los_dias', label: 'Sí, todos los días', puntos: 100 },
      { value: 'a_veces', label: 'A veces', puntos: 60 },
      { value: 'muy_poco', label: 'Muy poco', puntos: 30 },
      { value: 'no_registro', label: 'No registro mis ventas', puntos: 0 },
    ],
  },
  {
    id: 'q4',
    paso: 2,
    area: 'finanzas',
    titulo: '¿Sabes cuánto ganas realmente después de pagar tus gastos?',
    ayuda: 'Hablamos de la ganancia que te queda limpia.',
    opciones: [
      { value: 'claridad', label: 'Sí, lo sé con claridad', puntos: 100 },
      { value: 'mas_o_menos', label: 'Más o menos', puntos: 60 },
      { value: 'no_seguro', label: 'No estoy seguro', puntos: 30 },
      { value: 'no_lo_se', label: 'No lo sé', puntos: 0 },
    ],
  },
  {
    id: 'q5',
    paso: 2,
    area: 'finanzas',
    titulo: '¿Separas el dinero del negocio del dinero personal?',
    ayuda: 'Es uno de los hábitos que más ayuda a crecer.',
    opciones: [
      { value: 'siempre', label: 'Sí, siempre', puntos: 100 },
      { value: 'a_veces', label: 'A veces', puntos: 55 },
      { value: 'mismo_dinero', label: 'No, uso el mismo dinero', puntos: 15 },
      { value: 'no_sabia', label: 'No sabía que debía hacerlo', puntos: 0 },
    ],
  },
  {
    id: 'q6',
    paso: 3,
    area: 'marketing',
    titulo: '¿Tu negocio se promociona en redes sociales o WhatsApp?',
    ayuda: 'Cuenta lo que haces hoy, sin presión.',
    opciones: [
      { value: 'constante', label: 'Sí, publico constantemente', puntos: 100 },
      { value: 'de_vez', label: 'Publico de vez en cuando', puntos: 70 },
      { value: 'solo_respondo', label: 'Solo respondo cuando me escriben', puntos: 45 },
      { value: 'casi_no', label: 'Casi no promociono mi negocio', puntos: 20 },
      { value: 'no_uso', label: 'No uso redes para vender', puntos: 0 },
    ],
  },
  {
    id: 'q7',
    paso: 3,
    area: 'marketing',
    titulo: '¿Tus redes muestran información clara para comprar?',
    ayuda: 'Precios, horarios, ubicación y contacto a la vista.',
    opciones: [
      { value: 'completa', label: 'Sí: precios, horarios, ubicación y contacto', puntos: 100 },
      { value: 'algo', label: 'Tienen algo de información', puntos: 60 },
      { value: 'falta', label: 'Falta información importante', puntos: 30 },
      { value: 'sin_redes', label: 'No tengo redes bien organizadas', puntos: 0 },
    ],
  },
  {
    id: 'q8',
    paso: 4,
    area: 'inventario',
    titulo: '¿Llevas control de tus productos, materia prima o insumos?',
    ayuda: 'Si tu negocio no maneja inventario, elige “No aplica”.',
    opciones: [
      { value: 'app', label: 'Sí, con una app o sistema', puntos: 100 },
      { value: 'excel', label: 'Sí, en Excel o libreta', puntos: 75 },
      { value: 'memoria', label: 'Lo manejo de memoria', puntos: 35 },
      { value: 'sin_control', label: 'No llevo control', puntos: 0 },
      { value: 'no_aplica', label: 'No aplica para mi negocio', noAplica: true },
    ],
  },
  {
    id: 'q9',
    paso: 4,
    area: 'inventario',
    titulo: '¿Has perdido ventas por falta de productos, materia prima o insumos?',
    ayuda: 'Nos ayuda a saber si tu stock te acompaña.',
    opciones: [
      { value: 'nunca', label: 'No me ha pasado', puntos: 100 },
      { value: 'casi_nunca', label: 'Casi nunca', puntos: 75 },
      { value: 'a_veces', label: 'A veces', puntos: 45 },
      { value: 'varias_veces', label: 'Sí, varias veces', puntos: 0 },
      { value: 'no_seguro', label: 'No estoy seguro', puntos: 40 },
    ],
  },
  {
    id: 'q10',
    paso: 5,
    titulo: '¿Cuál consideras que es el mayor problema actual de tu negocio?',
    ayuda: 'Elige el que más te preocupa hoy. Vamos muy bien.',
    opciones: [
      { value: 'vendo_poco', label: 'Vendo poco' },
      { value: 'no_promociono', label: 'No sé cómo promocionar mi negocio' },
      { value: 'sin_inventario', label: 'No controlo bien mi inventario' },
      { value: 'no_se_ganancia', label: 'No sé si estoy ganando o perdiendo' },
      { value: 'muchos_gastos', label: 'Tengo muchos gastos' },
      { value: 'sin_orden', label: 'No tengo orden en mi negocio' },
      { value: 'mal_redes', label: 'No uso bien las redes sociales' },
      { value: 'no_se_productos', label: 'No sé qué productos me convienen vender más' },
      { value: 'falta_tiempo', label: 'Me falta tiempo para organizarme' },
      { value: 'otro', label: 'Otro problema' },
    ],
  },
]

const ETIQUETAS_AREA: Record<DiagnosticoArea, string> = {
  ventas: 'Ventas',
  finanzas: 'Finanzas',
  marketing: 'Marketing',
  inventario: 'Inventario',
}

// Reglas de "problema detectado": opción débil -> mensaje mostrado al usuario.
const REGLAS_PROBLEMA: { pregunta: string; valores: string[]; mensaje: string }[] = [
  { pregunta: 'q3', valores: ['muy_poco', 'no_registro'], mensaje: 'No registras tus ventas todos los días.' },
  { pregunta: 'q4', valores: ['no_seguro', 'no_lo_se'], mensaje: 'No tienes claridad sobre tu ganancia real.' },
  { pregunta: 'q5', valores: ['mismo_dinero', 'no_sabia'], mensaje: 'Mezclas el dinero del negocio con el personal.' },
  { pregunta: 'q6', valores: ['casi_no', 'no_uso'], mensaje: 'Casi no promocionas tu negocio en redes.' },
  { pregunta: 'q7', valores: ['falta', 'sin_redes'], mensaje: 'Tus redes sociales no tienen información completa.' },
  { pregunta: 'q8', valores: ['memoria', 'sin_control'], mensaje: 'Tu inventario se maneja de forma poco ordenada.' },
  { pregunta: 'q9', valores: ['a_veces', 'varias_veces'], mensaje: 'Has perdido ventas por falta de productos o insumos.' },
]

// Recomendaciones sugeridas por área (de la más débil a la más fuerte).
const RECOMENDACIONES_AREA: Record<DiagnosticoArea, string[]> = {
  finanzas: [
    'Separa el dinero del negocio del dinero personal.',
    'Calcula tu ganancia real restando todos tus gastos del mes.',
  ],
  ventas: [
    'Registra tus ventas todos los días, aunque sea en una libreta.',
    'Suma un canal digital (WhatsApp o redes) para vender más.',
  ],
  marketing: [
    'Crea una promoción semanal y publícala en tus redes.',
    'Completa tus redes con precios, horarios, ubicación y contacto.',
  ],
  inventario: [
    'Controla tus productos e insumos con un stock mínimo.',
    'Identifica qué productos se venden más y cuáles te conviene reponer.',
  ],
}

const MENSAJES_NIVEL: Record<'bajo' | 'medio' | 'alto', string> = {
  bajo: 'Necesitas empezar ordenando ventas, gastos e inventario. Demos el primer paso juntos.',
  medio: 'Vas por buen camino, pero necesitas organizar mejor tus áreas clave.',
  alto: 'Tu negocio está bien encaminado. Ahora puedes mejorar marketing, reportes y crecimiento.',
}

function nivelDeSalud(salud: number): 'bajo' | 'medio' | 'alto' {
  if (salud < 40) {
    return 'bajo'
  }
  if (salud < 70) {
    return 'medio'
  }
  return 'alto'
}

function puntosDe(preguntaId: string, respuestas: DiagnosticoRespuestas): number | null {
  const pregunta = PREGUNTAS_DIAGNOSTICO.find(p => p.id === preguntaId)
  const opcion = pregunta?.opciones.find(o => o.value === respuestas[preguntaId])
  if (!opcion || opcion.noAplica) {
    return null
  }
  return typeof opcion.puntos === 'number' ? opcion.puntos : null
}

function promedio(valores: (number | null)[]): number | null {
  const validos = valores.filter((v): v is number => typeof v === 'number')
  if (validos.length === 0) {
    return null
  }
  return Math.round(validos.reduce((a, b) => a + b, 0) / validos.length)
}

function etiquetaOpcion(preguntaId: string, respuestas: DiagnosticoRespuestas): string | null {
  const pregunta = PREGUNTAS_DIAGNOSTICO.find(p => p.id === preguntaId)
  const opcion = pregunta?.opciones.find(o => o.value === respuestas[preguntaId])
  return opcion?.label ?? null
}

export function calcularDiagnostico(respuestas: DiagnosticoRespuestas): DiagnosticoResultado {
  const ventas = promedio([puntosDe('q2', respuestas), puntosDe('q3', respuestas)]) ?? 0
  const finanzas = promedio([puntosDe('q4', respuestas), puntosDe('q5', respuestas)]) ?? 0
  const marketing = promedio([puntosDe('q6', respuestas), puntosDe('q7', respuestas)]) ?? 0
  // "No aplica" en q8 excluye toda el área de inventario (ignora q9 aunque se haya respondido antes).
  const inventario = respuestas.q8 === 'no_aplica'
    ? null
    : promedio([puntosDe('q8', respuestas), puntosDe('q9', respuestas)])

  const areasParaSalud: { area: DiagnosticoArea; score: number }[] = [
    { area: 'ventas', score: ventas },
    { area: 'finanzas', score: finanzas },
    { area: 'marketing', score: marketing },
  ]
  if (inventario !== null) {
    areasParaSalud.push({ area: 'inventario', score: inventario })
  }

  const saludGeneral = Math.round(
    areasParaSalud.reduce((acc, a) => acc + a.score, 0) / areasParaSalud.length,
  )
  const nivel = nivelDeSalud(saludGeneral)

  const problemas = REGLAS_PROBLEMA
    .filter(regla => regla.valores.includes(respuestas[regla.pregunta] ?? ''))
    .map(regla => regla.mensaje)

  // Recomendaciones: priorizamos las áreas más débiles.
  const ordenadas = [...areasParaSalud].sort((a, b) => a.score - b.score)
  const recomendaciones: string[] = []
  for (const { area } of ordenadas) {
    for (const rec of RECOMENDACIONES_AREA[area]) {
      if (recomendaciones.length < 5 && !recomendaciones.includes(rec)) {
        recomendaciones.push(rec)
      }
    }
  }

  // Frase principal: nombra las dos áreas más débiles.
  const dosMasDebiles = ordenadas.slice(0, 2).map(a => ETIQUETAS_AREA[a.area].toLowerCase())
  const recomendacionPrincipal = nivel === 'alto'
    ? 'Tu negocio tiene una buena base. Es momento de potenciar marketing y crecimiento.'
    : `Tu negocio tiene potencial, pero necesita mejorar primero en ${dosMasDebiles.join(' y ')}.`

  return {
    saludGeneral,
    nivel,
    areas: { ventas, finanzas, marketing, inventario },
    problemas,
    recomendaciones,
    mensajeNivel: MENSAJES_NIVEL[nivel],
    recomendacionPrincipal,
    rubro: etiquetaOpcion('q1', respuestas),
    canalPrincipal: etiquetaOpcion('q2', respuestas),
    problemaPrincipal: etiquetaOpcion('q10', respuestas),
    version: DIAGNOSTICO_VERSION,
  }
}

// Valida que estén todas las preguntas respondidas (q9 se omite si q8 = No aplica).
export function preguntasPendientes(respuestas: DiagnosticoRespuestas): string[] {
  const inventarioNoAplica = respuestas.q8 === 'no_aplica'
  return PREGUNTAS_DIAGNOSTICO
    .filter(p => !(inventarioNoAplica && p.id === 'q9'))
    .filter(p => !respuestas[p.id])
    .map(p => p.id)
}
