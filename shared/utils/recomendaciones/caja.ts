// Motor de reglas de recomendaciones para la vista de Caja (turno actual).
// Lee lo que el turno ya tiene en memoria (estado de caja, movimientos, productos
// vendidos) y arma el análisis sin IA. No inventa metas ni promedios que el sistema
// todavía no calcula: solo habla de datos reales del turno en curso.

import { MAX_RECOMENDACIONES, type Recomendacion } from './tipos'

export type CajaRecoContexto = {
  cajaAbierta: boolean
  // Cantidad de ventas registradas en el turno.
  numVentas: number
  // Total ingresado por ventas en el turno.
  ventasTurno: number
  // Ventas marcadas como "por cerrar" (pendientes de revisar al cierre).
  ventasPorCerrar: number
  // Total de egresos (salidas de dinero) del turno.
  egresosTurno: number
  // Producto más vendido del turno, si hubo ventas.
  productoTop: string | null
}

function bs(valor: number): string {
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

export function recomendacionesCaja(ctx: CajaRecoContexto): Recomendacion[] {
  // Caja cerrada: lo único accionable es abrir el turno.
  if (!ctx.cajaAbierta) {
    return [
      {
        id: 'caja-cerrada',
        tono: 'oportunidad',
        icono: 'pi pi-lock-open',
        titulo: 'Abre tu caja',
        texto: 'Registra el turno para llevar el control del dinero que entra y sale hoy.',
      },
    ]
  }

  const lista: Recomendacion[] = []

  // Estado del turno: arranque sin ventas, o buen ritmo.
  if (ctx.numVentas === 0) {
    lista.push({
      id: 'caja-sin-ventas',
      tono: 'oportunidad',
      icono: 'pi pi-shopping-bag',
      titulo: 'Aún sin ventas',
      texto: 'Comparte una promoción por WhatsApp o invita a tus clientes para arrancar el turno.',
    })
  } else {
    lista.push({
      id: 'caja-buen-turno',
      tono: 'positivo',
      icono: 'pi pi-check-circle',
      titulo: '¡Vas bien!',
      texto: `Llevas ${ctx.numVentas} ${ctx.numVentas === 1 ? 'venta' : 'ventas'} por Bs ${bs(ctx.ventasTurno)} en este turno.`,
    })
  }

  // Ventas pendientes de cerrar: aviso para no olvidarlas en el cierre.
  if (ctx.ventasPorCerrar > 0) {
    lista.push({
      id: 'caja-por-cerrar',
      tono: 'alerta',
      icono: 'pi pi-exclamation-triangle',
      titulo: 'Atención',
      texto: `Tienes ${ctx.ventasPorCerrar} ${ctx.ventasPorCerrar === 1 ? 'venta lista' : 'ventas listas'} para revisar y cerrar al final del turno.`,
    })
  }

  // Producto estrella: dónde concentrar el esfuerzo el resto del turno.
  if (ctx.productoTop) {
    lista.push({
      id: 'caja-producto-top',
      tono: 'info',
      icono: 'pi pi-star',
      titulo: 'Mi recomendación',
      texto: `"${ctx.productoTop}" es lo más vendido del turno. Promociónalo en la tarde y noche para cerrar mejor.`,
    })
  }

  // Egresos que se comen una parte grande de las ventas: cuidar las salidas.
  if (ctx.egresosTurno > 0 && ctx.ventasTurno > 0 && ctx.egresosTurno / ctx.ventasTurno >= 0.3) {
    lista.push({
      id: 'caja-egresos',
      tono: 'alerta',
      icono: 'pi pi-arrow-down',
      titulo: 'Cuida tus salidas',
      texto: `Los egresos del turno (Bs ${bs(ctx.egresosTurno)}) ya son una parte importante de tus ventas.`,
    })
  }

  // Consejo de cierre: el arqueo evita diferencias de efectivo al final.
  lista.push({
    id: 'caja-arqueo',
    tono: 'info',
    icono: 'pi pi-calculator',
    titulo: 'Cierra con arqueo',
    texto: 'Al cerrar el turno, cuenta el efectivo físico para detectar cualquier diferencia.',
  })

  return lista.slice(0, MAX_RECOMENDACIONES)
}
