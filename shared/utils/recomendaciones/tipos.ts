// Contrato común de las recomendaciones de Haru, compartido por todas las vistas
// (marketing, finanzas, inicio…). Es un módulo puro: no depende de Vue ni Nitro,
// así el motor de reglas corre igual en el cliente o en el servidor sin gastar IA.

// El tono define el color del indicador y la intención del mensaje:
// - positivo: el negocio va bien en ese punto, refuerza el hábito.
// - oportunidad: hay una acción concreta que puede mejorar el resultado.
// - alerta: algo necesita atención para no perder dinero o clientes.
// - info: consejo o dato útil, sin urgencia.
export type RecomendacionTono = 'positivo' | 'oportunidad' | 'alerta' | 'info'

// Acción opcional al pie de la recomendación. El tipo decide cómo la resuelve la
// vista: navegar a una ruta, abrir el chat de Haru, o un evento propio de la vista
// (por ejemplo, preseleccionar un objetivo de publicación en Marketing).
export type RecomendacionAccion = {
  label: string
  tipo: 'ruta' | 'haru' | 'evento'
  valor: string
}

export type Recomendacion = {
  // Identificador estable de la regla, sirve de :key y para no repetir.
  id: string
  tono: RecomendacionTono
  // Clase PrimeIcons (ej: 'pi pi-megaphone').
  icono: string
  titulo: string
  texto: string
  accion?: RecomendacionAccion
}

// Las vistas muestran un panel acotado; 4 es el tope que entra sin saturar
// (coincide con el diseño de los mockups).
export const MAX_RECOMENDACIONES = 4
