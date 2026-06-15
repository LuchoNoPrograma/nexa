// Tipos y helpers del módulo de Marketing (publicaciones de Haru IA).
// Módulo puro (sin Vue/Nitro) compartido por la página (cliente) y la API (servidor).
// La publicación es contenido listo para redes generado a partir de un producto real.

export type MarketingEstado = 'sugerida' | 'publicada' | 'descartada'

export type MarketingPublicacion = {
  id: string
  productoId: string | null
  productoNombre: string | null
  titulo: string
  texto: string
  hashtags: string[]
  ideaVideo: string | null
  mejorHora: string | null
  audiencia: string | null
  objetivo: string | null
  impacto: number
  imagenUrl: string | null
  estado: MarketingEstado
  publicadoAt: string | null
  createdAt: string
}

// Redes donde el usuario puede publicar. WhatsApp permite prellenar texto (wa.me);
// el resto abre la red y se apoya en "copiar texto" porque no exponen un compositor web.
export type RedSocial = {
  id: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok'
  nombre: string
  icono: string
  color: string
}

export const REDES_SOCIALES: RedSocial[] = [
  { id: 'whatsapp', nombre: 'WhatsApp', icono: 'pi pi-whatsapp', color: '#25d366' },
  { id: 'instagram', nombre: 'Instagram', icono: 'pi pi-instagram', color: '#e1306c' },
  { id: 'facebook', nombre: 'Facebook', icono: 'pi pi-facebook', color: '#1877f2' },
  { id: 'tiktok', nombre: 'TikTok', icono: 'pi pi-video', color: '#111111' },
]

// Texto completo listo para pegar: copy + hashtags en una sola cadena.
export function textoCompleto(post: Pick<MarketingPublicacion, 'texto' | 'hashtags'>): string {
  const tags = (post.hashtags ?? []).join(' ').trim()
  return tags ? `${post.texto}\n\n${tags}` : post.texto
}

// Enlace para abrir la red elegida. WhatsApp lleva el texto prellenado.
export function enlaceRed(red: RedSocial['id'], texto: string): string {
  if (red === 'whatsapp') {
    return `https://wa.me/?text=${encodeURIComponent(texto)}`
  }

  const destinos: Record<Exclude<RedSocial['id'], 'whatsapp'>, string> = {
    instagram: 'https://www.instagram.com/',
    facebook: 'https://www.facebook.com/',
    tiktok: 'https://www.tiktok.com/upload',
  }

  return destinos[red]
}
