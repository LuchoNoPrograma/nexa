// Motor de reglas de recomendaciones para la vista de Marketing.
// Decide QUÉ recomendar a partir de datos reales del negocio (productos, ritmo de
// publicación, stock sin moverse). No llama a la IA: son reglas deterministas, así
// el panel se recalcula gratis cada vez que cambian los datos.

import { MAX_RECOMENDACIONES, type Recomendacion } from './tipos'

// Datos mínimos que las reglas necesitan. Los provee la API de marketing dentro de
// su lectura inicial (agregados SQL baratos), sin pedir un request aparte.
export type MarketingRecoContexto = {
  totalProductos: number
  publicadasEstaSemana: number
  productosBajoMovimiento: number
  productosSinImagen: number
}

// Devuelve las recomendaciones en orden de prioridad, ya recortadas al máximo que
// muestra el panel. Cada caso de uso es una entrada explícita: si la condición se
// cumple, la recomendación entra; el orden del arreglo es la prioridad.
export function recomendacionesMarketing(ctx: MarketingRecoContexto): Recomendacion[] {
  // Sin catálogo no hay nada que publicar: es el único mensaje que tiene sentido.
  if (ctx.totalProductos === 0) {
    return [
      {
        id: 'mkt-sin-productos',
        tono: 'oportunidad',
        icono: 'pi pi-box',
        titulo: 'Empieza por tu catálogo',
        texto: 'Agrega tu primer producto para que Haru arme publicaciones con datos reales.',
        accion: { label: 'Ir a inventario', tipo: 'ruta', valor: '/pos/catalogo' },
      },
    ]
  }

  const lista: Recomendacion[] = []

  // Ritmo de publicación: una sola de estas tres entra según cuánto publicó.
  if (ctx.publicadasEstaSemana === 0) {
    lista.push({
      id: 'mkt-publica-hoy',
      tono: 'oportunidad',
      icono: 'pi pi-megaphone',
      titulo: 'Publica hoy',
      texto: 'Esta semana no publicaste nada. Los negocios que publican seguido aparecen más y venden más.',
      accion: { label: 'Crear publicación', tipo: 'evento', valor: 'nueva' },
    })
  } else if (ctx.publicadasEstaSemana < 3) {
    lista.push({
      id: 'mkt-sigue-ritmo',
      tono: 'info',
      icono: 'pi pi-calendar',
      titulo: 'Sigue el ritmo',
      texto: `Van ${ctx.publicadasEstaSemana} esta semana. Apunta a 3 publicaciones para mantener tu negocio visible.`,
      accion: { label: 'Publicar otra vez', tipo: 'evento', valor: 'nueva' },
    })
  } else {
    lista.push({
      id: 'mkt-buen-ritmo',
      tono: 'positivo',
      icono: 'pi pi-check-circle',
      titulo: 'Buen ritmo',
      texto: `Llevas ${ctx.publicadasEstaSemana} publicaciones esta semana. Así te mantienes presente para tus clientes.`,
    })
  }

  // Stock que no se mueve: convertirlo en oferta es la acción más rentable.
  if (ctx.productosBajoMovimiento > 0) {
    lista.push({
      id: 'mkt-bajo-movimiento',
      tono: 'oportunidad',
      icono: 'pi pi-tag',
      titulo: 'Aprovecha tu stock',
      texto: `Tienes ${ctx.productosBajoMovimiento} ${ctx.productosBajoMovimiento === 1 ? 'producto' : 'productos'} sin moverse. Arma una oferta y libéralos.`,
      accion: { label: 'Crear oferta', tipo: 'evento', valor: 'sobrante' },
    })
  }

  // Con dos o más productos se puede armar un combo, que sube el ticket promedio.
  if (ctx.totalProductos >= 2) {
    lista.push({
      id: 'mkt-combo',
      tono: 'oportunidad',
      icono: 'pi pi-gift',
      titulo: 'Los combos funcionan',
      texto: 'Combina productos en una promoción: el cliente compra más y tú vendes el conjunto.',
      accion: { label: 'Armar combo', tipo: 'evento', valor: 'combo' },
    })
  }

  // Fotos: las publicaciones con imagen reciben más atención que el texto solo.
  if (ctx.productosSinImagen > 0) {
    lista.push({
      id: 'mkt-sin-imagen',
      tono: 'info',
      icono: 'pi pi-image',
      titulo: 'Agrega fotos',
      texto: `${ctx.productosSinImagen} ${ctx.productosSinImagen === 1 ? 'producto no tiene' : 'productos no tienen'} foto. Una buena imagen logra más clics que solo texto.`,
      accion: { label: 'Ir a inventario', tipo: 'ruta', valor: '/pos/catalogo' },
    })
  }

  // Consejo de cierre: siempre deja el panel con al menos un mensaje útil.
  lista.push({
    id: 'mkt-proposito',
    tono: 'info',
    icono: 'pi pi-bullseye',
    titulo: 'Publica con propósito',
    texto: 'Un mensaje claro + una imagen atractiva = más clientes. Revisa el texto antes de compartir.',
  })

  return lista.slice(0, MAX_RECOMENDACIONES)
}
