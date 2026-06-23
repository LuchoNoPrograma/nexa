// Motor de reglas de recomendaciones para la vista de Finanzas.
// Trabaja sobre el resultado del periodo que la página ya calcula (cascada), así que
// no necesita pedir datos extra ni llamar a la IA: las reglas leen ganancia, gastos
// y margen, y arman mensajes claros en lenguaje del dueño del negocio.

import { MAX_RECOMENDACIONES, type Recomendacion } from './tipos'

export type FinanzasRecoContexto = {
  // Ingresos del periodo (ventas + otros ingresos).
  ventas: number
  // Lo que costó la mercadería vendida.
  costoVentas: number
  // Gastos del negocio del periodo (operativos + financieros, ya netos).
  gastos: number
  // Resultado del periodo: positivo = ganancia, negativo = pérdida.
  utilidadNeta: number
}

// Formatea montos como en la página: separador de miles, sin decimales salvo que
// se pidan (el dato "por cada Bs 100" sí los necesita).
function bs(valor: number, decimales = 0): string {
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor)
}

export function recomendacionesFinanzas(ctx: FinanzasRecoContexto): Recomendacion[] {
  // Sin ventas en el periodo no hay nada que analizar: se invita a registrar.
  if (ctx.ventas <= 0) {
    return [
      {
        id: 'fin-sin-ventas',
        tono: 'info',
        icono: 'pi pi-chart-line',
        titulo: 'Aún sin ventas este periodo',
        texto: 'Registra tus ventas y gastos para que Haru te diga cómo va tu dinero.',
      },
    ]
  }

  const lista: Recomendacion[] = []
  const salidas = ctx.costoVentas + ctx.gastos
  const gastosPct = salidas > 0 ? (ctx.gastos / salidas) * 100 : 0
  // Resultado por cada Bs 100 vendidos: ganancia o pérdida proporcional.
  const porCien = Math.abs((ctx.utilidadNeta / ctx.ventas) * 100)
  const perdida = ctx.utilidadNeta < 0

  // Lectura principal del periodo: ganaste o perdiste.
  if (perdida) {
    lista.push({
      id: 'fin-perdida',
      tono: 'alerta',
      icono: 'pi pi-arrow-down',
      titulo: 'Estás perdiendo dinero',
      texto: `Tus gastos son mayores que tus ingresos. Perdiste Bs ${bs(Math.abs(ctx.utilidadNeta))} este periodo: revisemos y reduzcamos costos.`,
      accion: { label: 'Hablar con Haru', tipo: 'haru', valor: 'finanzas' },
    })
  } else {
    lista.push({
      id: 'fin-ganancia',
      tono: 'positivo',
      icono: 'pi pi-arrow-up',
      titulo: 'Vas con ganancia',
      texto: `Este periodo ganaste Bs ${bs(ctx.utilidadNeta)}. Mantén el control de tus costos para que siga creciendo.`,
    })
  }

  // Gastos que se llevan la mayor parte de las salidas: candidato a optimizar.
  if (gastosPct >= 50) {
    lista.push({
      id: 'fin-gastos',
      tono: 'oportunidad',
      icono: 'pi pi-wallet',
      titulo: 'Revisa tus gastos del negocio',
      texto: `Representan el ${bs(gastosPct, 1)}% de tus salidas. Hay oportunidades para optimizar.`,
    })
  }

  // Margen expresado de forma concreta: cuánto ganas o pierdes por cada Bs 100.
  lista.push(perdida
    ? {
        id: 'fin-margen',
        tono: 'alerta',
        icono: 'pi pi-percentage',
        titulo: 'Mejora tu margen de ganancia',
        texto: `Por cada Bs 100 que vendes, pierdes Bs ${bs(porCien, 2)}.`,
      }
    : {
        id: 'fin-margen',
        tono: 'positivo',
        icono: 'pi pi-percentage',
        titulo: 'Tu margen de ganancia',
        texto: `Por cada Bs 100 que vendes, te quedan Bs ${bs(porCien, 2)} limpios.`,
      })

  // Consejo de cierre: revisar precios es la palanca de fondo para la rentabilidad.
  lista.push({
    id: 'fin-precios',
    tono: 'info',
    icono: 'pi pi-tags',
    titulo: 'Define precios estratégicos',
    texto: 'Ajusta tus precios para cubrir costos y obtener una ganancia real.',
  })

  return lista.slice(0, MAX_RECOMENDACIONES)
}
