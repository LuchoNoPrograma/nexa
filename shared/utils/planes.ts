// Catálogo de planes NEXA (modelo Freemium).
// Módulo puro (sin Vue/Nitro) compartido por la página y los componentes.
// Es la ÚNICA fuente de verdad de precios y beneficios: cambiar un número aquí
// se refleja en el selector del diagnóstico y en la página /pos/planes.
//
// Precios tomados del estudio de factibilidad IMPULSA/NEXA (Tabla 25 "Planes de
// acceso"): Gratuito 0 Bs, Mensual 25 Bs, Anual 270 Bs (ahorro de 30 Bs frente
// a pagar 12 meses sueltos: 25 × 12 = 300).

export type PlanPeriodo = 'ninguno' | 'mensual' | 'anual'

export type Plan = {
  codigo: 'free' | 'mensual' | 'anual'
  nombre: string
  // Precio en bolivianos por el período completo (0 en el gratuito).
  precioBs: number
  periodo: PlanPeriodo
  // Texto corto bajo el precio: "Gratis", "por mes", "al año".
  unidad: string
  // Consultas de IA incluidas al mes (null = sin límite definido).
  iaConsultasMes: number | null
  // Marca el plan sugerido (badge "Recomendado").
  destacado: boolean
  // Resumen de una línea para la tarjeta.
  resumen: string
  // Lista de beneficios mostrados con check.
  beneficios: string[]
}

// Versión del catálogo: subir si cambian precios/beneficios para invalidar caches.
export const PLANES_VERSION = 1

export const PLANES: Plan[] = [
  {
    codigo: 'free',
    nombre: 'Gratuito',
    precioBs: 0,
    periodo: 'ninguno',
    unidad: 'Gratis para siempre',
    iaConsultasMes: 10,
    destacado: false,
    resumen: 'Para empezar a ordenar tu negocio sin costo.',
    beneficios: [
      'Diagnóstico empresarial básico',
      'Herramientas esenciales del POS',
      'Recomendaciones generales',
      'Asistente con IA: 10 consultas al mes',
    ],
  },
  {
    codigo: 'mensual',
    nombre: 'Mensual',
    precioBs: 25,
    periodo: 'mensual',
    unidad: 'por mes',
    iaConsultasMes: null,
    destacado: true,
    resumen: 'Todo lo que necesitas para crecer mes a mes.',
    beneficios: [
      'Funcionalidades avanzadas completas',
      'Estrategias empresariales personalizadas',
      'Marketing y ventas ampliados',
      'Reportes avanzados',
      'Asistente con IA con mayor capacidad',
    ],
  },
  {
    codigo: 'anual',
    nombre: 'Anual',
    precioBs: 270,
    periodo: 'anual',
    unidad: 'al año',
    iaConsultasMes: null,
    destacado: false,
    resumen: 'El plan mensual con el mejor precio y beneficios exclusivos.',
    beneficios: [
      'Todo lo del plan Mensual',
      'Actualizaciones permanentes',
      'Beneficios exclusivos',
      'Ahorras frente al pago mensual',
    ],
  },
]

export function planPorCodigo(codigo: string): Plan | undefined {
  return PLANES.find(p => p.codigo === codigo)
}

// Formatea un precio en bolivianos sin decimales (estilo local: "Bs 25").
export function formatoBs(monto: number): string {
  return `Bs ${Math.round(monto)}`
}

// Costo mensual equivalente de un plan (para comparar mensual vs. anual).
export function costoMensualEquivalente(plan: Plan): number {
  if (plan.periodo === 'anual') {
    return plan.precioBs / 12
  }
  return plan.precioBs
}

// Ahorro en Bs del plan anual frente a pagar 12 meses del plan mensual.
export function ahorroAnualBs(): number {
  const mensual = planPorCodigo('mensual')
  const anual = planPorCodigo('anual')
  if (!mensual || !anual) {
    return 0
  }
  return Math.max(0, mensual.precioBs * 12 - anual.precioBs)
}
