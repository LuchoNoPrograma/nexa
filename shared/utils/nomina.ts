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
  horasMensualesReferencia: 240,
  semanasPorMes: 4.33,
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

// Cálculo puro: a partir de las horas semanales y la configuración.
export function calcularSueldo(horasSemanales: number, config: NominaConfig): CalculoSueldo {
  const vHora = valorHora(config)
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
