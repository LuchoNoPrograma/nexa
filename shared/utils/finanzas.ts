// Cerebro de Finanzas NEXA: arma el estado de Utilidad Neta (la "cascada" del
// docente) a partir de datos reales del negocio. Módulo puro (sin Vue/Nitro),
// compartido por la página (cliente) y la API (servidor), igual que diagnostico.ts.
//
// La cascada es:
//   Ventas del periodo
//   (−) Costo de Ventas        → Utilidad Bruta      → Margen Bruto %
//   (−) Gastos Operativos      → Utilidad Operativa  → Margen Operativo %
//   (−) Gastos Financieros
//   (+) Otros ingresos         → Utilidad Neta       → Margen Neto (ROS) %
//
// Decisión de diseño (con el usuario): SIN impuestos, SIN ROA/ROE. El negocio no
// tiene activos totales ni capital contable a la mano. Solo los 3 márgenes.

export type GrupoContable =
  | 'venta' // ingreso por venta de productos/servicios
  | 'otro_ingreso' // ingreso que no es venta (intereses ganados, reembolsos…)
  | 'inventario' // compra de mercadería/insumos: NO es gasto hasta venderse
  | 'gasto_operativo' // sueldos, alquiler, luz, publicidad, transporte…
  | 'gasto_financiero' // intereses y comisiones bancarias

// Taxonomía de categorías de caja_movimiento → grupo contable. La capa de captura
// (movimientos manuales) usa estas claves; cualquier categoría desconocida cae en
// 'gasto_operativo' si es egreso u 'otro_ingreso' si es ingreso (ver grupoContable).
export const CATEGORIAS_EGRESO: { value: string, label: string, grupo: GrupoContable }[] = [
  { value: 'sueldos', label: 'Sueldos', grupo: 'gasto_operativo' },
  { value: 'alquiler', label: 'Alquiler del local', grupo: 'gasto_operativo' },
  { value: 'servicios_basicos', label: 'Luz, agua e internet', grupo: 'gasto_operativo' },
  { value: 'transporte', label: 'Transporte y reparto', grupo: 'gasto_operativo' },
  { value: 'publicidad', label: 'Publicidad', grupo: 'gasto_operativo' },
  { value: 'mantenimiento', label: 'Mantenimiento', grupo: 'gasto_operativo' },
  { value: 'otros_gastos', label: 'Otros gastos', grupo: 'gasto_operativo' },
  { value: 'compra_inventario', label: 'Compra de inventario', grupo: 'inventario' },
  { value: 'gasto_financiero', label: 'Intereses y comisiones bancarias', grupo: 'gasto_financiero' },
]

export const CATEGORIAS_INGRESO: { value: string, label: string, grupo: GrupoContable }[] = [
  { value: 'venta', label: 'Venta', grupo: 'venta' },
  { value: 'otro_ingreso', label: 'Otros ingresos', grupo: 'otro_ingreso' },
]

// Clasifica un movimiento de caja en su grupo contable. Tolerante: si la categoría
// no está en la taxonomía, usa un default razonable según el tipo del movimiento.
export function grupoContable(tipo: 'ingreso' | 'egreso', categoria: string | null | undefined): GrupoContable {
  const clave = (categoria ?? '').trim().toLowerCase()
  const tabla = tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO
  const match = tabla.find((c) => c.value === clave)
  if (match) return match.grupo
  return tipo === 'ingreso' ? 'otro_ingreso' : 'gasto_operativo'
}

// Entrada del motor: números ya agregados por la API desde datos reales.
export type FinanzasInput = {
  // Ingresos por venta del periodo (suma de ventas pagadas en POS/catálogo).
  ventasPeriodo: number
  // Costo de las ventas: Σ (costo_unitario × cantidad) de lo realmente vendido.
  costoVentas: number
  // Gastos operativos efectivamente registrados. La planilla estimada no se
  // descuenta hasta que exista el movimiento de pago correspondiente.
  gastosOperativos: number
  // Gastos financieros: intereses/comisiones bancarias (grupo 'gasto_financiero').
  gastosFinancieros: number
  // Ingresos que no son venta (grupo 'otro_ingreso').
  otrosIngresos: number
}

export type PasoSigno = 'inicio' | 'resta' | 'suma' | 'resultado'

// Un renglón de la cascada, listo para pintar como waterfall.
export type PasoCascada = {
  clave: string
  etiqueta: string
  monto: number
  signo: PasoSigno
  // true cuando el renglón es un subtotal (Utilidad Bruta/Operativa/Neta).
  esResultado: boolean
  // Explicación en lenguaje llano para el tooltip (heurística de Nielsen: ayuda).
  explicacion: string
}

export type ResultadoFinanzas = {
  ventasPeriodo: number
  costoVentas: number
  utilidadBruta: number
  gastosOperativos: number
  utilidadOperativa: number
  gastosFinancieros: number
  otrosIngresos: number
  utilidadNeta: number
  // Márgenes en % (0..100). Null cuando no hay ventas (evita dividir entre cero).
  margenBruto: number | null
  margenOperativo: number | null
  margenNeto: number | null // ROS
  pasos: PasoCascada[]
}

function margen(parte: number, ventas: number): number | null {
  if (!ventas) return null
  return (parte / ventas) * 100
}

// Arma la cascada completa. Única fuente de verdad del cálculo financiero.
export function calcularFinanzas(input: FinanzasInput): ResultadoFinanzas {
  const ventasPeriodo = input.ventasPeriodo || 0
  const costoVentas = input.costoVentas || 0
  const gastosOperativos = input.gastosOperativos || 0
  const gastosFinancieros = input.gastosFinancieros || 0
  const otrosIngresos = input.otrosIngresos || 0

  const utilidadBruta = ventasPeriodo - costoVentas
  const utilidadOperativa = utilidadBruta - gastosOperativos
  const utilidadNeta = utilidadOperativa - gastosFinancieros + otrosIngresos

  const pasos: PasoCascada[] = [
    {
      clave: 'ventas',
      etiqueta: 'Ventas del periodo',
      monto: ventasPeriodo,
      signo: 'inicio',
      esResultado: false,
      explicacion: 'Todo el dinero que entró por tus ventas en este periodo.',
    },
    {
      clave: 'costo_ventas',
      etiqueta: 'Costo de Ventas',
      monto: costoVentas,
      signo: 'resta',
      esResultado: false,
      explicacion: 'Lo que te costó producir o comprar lo que vendiste.',
    },
    {
      clave: 'utilidad_bruta',
      etiqueta: 'Utilidad Bruta',
      monto: utilidadBruta,
      signo: 'resultado',
      esResultado: true,
      explicacion: 'Ganancia antes de pagar los gastos para operar.',
    },
    {
      clave: 'gastos_operativos',
      etiqueta: 'Gastos Operativos',
      monto: gastosOperativos,
      signo: 'resta',
      esResultado: false,
      explicacion: 'Sueldos, alquiler, luz, transporte, publicidad y otros gastos fijos.',
    },
    {
      clave: 'utilidad_operativa',
      etiqueta: 'Utilidad Operativa',
      monto: utilidadOperativa,
      signo: 'resultado',
      esResultado: true,
      explicacion: 'Lo que queda después de pagar los gastos para operar.',
    },
    {
      clave: 'gastos_financieros',
      etiqueta: 'Gastos Financieros',
      monto: gastosFinancieros,
      signo: 'resta',
      esResultado: false,
      explicacion: 'Intereses y comisiones bancarias.',
    },
    {
      clave: 'otros_ingresos',
      etiqueta: 'Otros ingresos',
      monto: otrosIngresos,
      signo: 'suma',
      esResultado: false,
      explicacion: 'Ingresos que no vienen de tus ventas.',
    },
    {
      clave: 'utilidad_neta',
      etiqueta: 'Utilidad Neta',
      monto: utilidadNeta,
      signo: 'resultado',
      esResultado: true,
      explicacion: 'Tu ganancia real del periodo, después de todo.',
    },
  ]

  return {
    ventasPeriodo,
    costoVentas,
    utilidadBruta,
    gastosOperativos,
    utilidadOperativa,
    gastosFinancieros,
    otrosIngresos,
    utilidadNeta,
    margenBruto: margen(utilidadBruta, ventasPeriodo),
    margenOperativo: margen(utilidadOperativa, ventasPeriodo),
    margenNeto: margen(utilidadNeta, ventasPeriodo),
    pasos,
  }
}

// Costeo por unidad de un producto: suma de componentes de costo directo.
export type ComponenteCosto = { tipo: string, nombre: string, monto: number }

export function sumarComponentesCosto(componentes: ComponenteCosto[] | null | undefined): number {
  if (!componentes?.length) return 0
  return componentes.reduce((sum, c) => sum + (Number(c.monto) || 0), 0)
}

// --- Tipo de negocio (global, a nivel tienda) ---
export type TipoNegocio = 'produccion' | 'comercial' | 'servicios'

// Deriva el tipo de negocio desde el rubro elegido en el diagnóstico (q1). Así el
// onboarding pre-llena el tipo sin una pregunta extra. Null = no se puede inferir.
export function tipoNegocioDesdeRubro(rubro: string | null | undefined): TipoNegocio | null {
  switch ((rubro ?? '').trim().toLowerCase()) {
    case 'comida':
    case 'artesania':
      return 'produccion'
    case 'tienda':
      return 'comercial'
    case 'servicios':
    case 'belleza':
      return 'servicios'
    default:
      return null
  }
}

// Mapea el tipo de negocio global al tipo_costeo por defecto de un producto nuevo.
// El dueño puede sobreescribirlo en el editor (override por producto).
export function costingTypePorDefecto(tipo: TipoNegocio | null | undefined): 'reventa' | 'produccion' | 'servicio' {
  if (tipo === 'produccion') return 'produccion'
  if (tipo === 'servicios') return 'servicio'
  return 'reventa' // 'comercial' o desconocido
}

// Tipos de componente de costo directo (mockup: materia prima, mano de obra…).
export const TIPOS_COMPONENTE_COSTO: { value: string, label: string, icon: string }[] = [
  { value: 'materia_prima', label: 'Materia prima', icon: '🧺' },
  { value: 'mano_obra', label: 'Mano de obra', icon: '⏱️' },
  { value: 'insumo', label: 'Insumos', icon: '🧴' },
  { value: 'otro', label: 'Otros', icon: '➕' },
]
