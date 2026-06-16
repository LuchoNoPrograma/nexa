// Cerebro de costo laboral: constantes de la cuadrícula (días/horas) y cálculo
// puro de costo mensual estimado. Auto-importado en app y server.

export type DiaSemana = { idx: number; corto: string; largo: string }

// idx 0 = Domingo .. 6 = Sábado (mapeo estable para los slots guardados).
// El orden del array es el de VISUALIZACIÓN: LUN..DOM (lunes primero).
export const DIAS_SEMANA: DiaSemana[] = [
  { idx: 1, corto: 'LUN', largo: 'Lunes' },
  { idx: 2, corto: 'MAR', largo: 'Martes' },
  { idx: 3, corto: 'MIÉ', largo: 'Miércoles' },
  { idx: 4, corto: 'JUE', largo: 'Jueves' },
  { idx: 5, corto: 'VIE', largo: 'Viernes' },
  { idx: 6, corto: 'SÁB', largo: 'Sábado' },
  { idx: 0, corto: 'DOM', largo: 'Domingo' },
]

// Jornada laboral máxima legal en Bolivia: 8 h/día y 48 h/semana (Art. 46,
// Ley General del Trabajo). Una jornada completa = 48 h/semana, y es la base
// que hace que un trabajador a tiempo completo alcance el salario mínimo.
export const JORNADA_SEMANAL_LEGAL = 48
export const SEMANAS_POR_MES = 4.33

// Horas mensuales de referencia = jornada legal completa proyectada al mes.
// 48 h/semana × 4.33 semanas = 207.84 h/mes. Debe ser consistente con la base
// semanal del cálculo (de lo contrario el costo nunca cuadra con el mínimo).
export const HORAS_MENSUALES_REFERENCIA = Math.round(JORNADA_SEMANAL_LEGAL * SEMANAS_POR_MES * 100) / 100

// Horas mostradas en la cuadrícula: 08:00 a 23:00 (16 filas). Cada celda = 1 hora.
export const HORA_INICIO = 8
export const HORA_FIN = 23
export const HORAS_DIA: number[] = Array.from(
  { length: HORA_FIN - HORA_INICIO + 1 },
  (_, i) => HORA_INICIO + i,
)

// Paleta para diferenciar trabajadores (verde, azul, morado, naranja, ...).
export const COLORES_EMPLEADO = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#14b8a6', '#ec4899']

export type Slot = { dia: number; hora: number }

export type NominaConfig = {
  salarioMinimoMensual: number
  horasMensualesReferencia: number
  semanasPorMes: number
}

export const NOMINA_CONFIG_DEFAULT: NominaConfig = {
  salarioMinimoMensual: 3300,
  horasMensualesReferencia: HORAS_MENSUALES_REFERENCIA,
  semanasPorMes: SEMANAS_POR_MES,
}

export function slotKey(dia: number, hora: number) {
  return `${dia}-${hora}`
}

// Valor de una hora de trabajo = mínimo mensual / horas mensuales de referencia.
export function valorHora(config: NominaConfig) {
  return config.horasMensualesReferencia > 0
    ? config.salarioMinimoMensual / config.horasMensualesReferencia
    : 0
}

export type CalculoSueldo = {
  horasSemanales: number
  horasMensuales: number
  valorHora: number
  sueldoMensual: number
}

// Cálculo puro: a partir de las horas semanales y la configuración. Si el
// empleado tiene su propio valor por hora (`valorHoraEmpleado`), se usa ese;
// si no, cae al valor por hora de la tienda. Así el pago por horas puede ser
// personalizado por persona sin romper a quienes no lo definen.
export function calcularSueldo(
  horasSemanales: number,
  config: NominaConfig,
  valorHoraEmpleado?: number | null,
): CalculoSueldo {
  const vHora = valorHoraEmpleado != null && valorHoraEmpleado > 0
    ? valorHoraEmpleado
    : valorHora(config)
  const horasMensuales = horasSemanales * config.semanasPorMes
  return {
    horasSemanales,
    horasMensuales,
    valorHora: vHora,
    sueldoMensual: vHora * horasMensuales,
  }
}

// Normaliza/saca duplicados de una lista de celdas marcadas y la deja dentro de
// los rangos válidos (defensa del backend frente a payloads sucios).
export function normalizarSlots(slots: unknown): Slot[] {
  if (!Array.isArray(slots)) {
    return []
  }

  const vistos = new Set<string>()
  const limpio: Slot[] = []

  for (const raw of slots) {
    const dia = Number((raw as Slot)?.dia)
    const hora = Number((raw as Slot)?.hora)

    if (!Number.isInteger(dia) || !Number.isInteger(hora)) {
      continue
    }
    if (dia < 0 || dia > 6 || hora < HORA_INICIO || hora > HORA_FIN) {
      continue
    }

    const key = slotKey(dia, hora)
    if (vistos.has(key)) {
      continue
    }
    vistos.add(key)
    limpio.push({ dia, hora })
  }

  return limpio
}
