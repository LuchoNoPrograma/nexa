// Control de acceso por roles/permisos. El helper `tieneAcceso` evalúa una
// expresión booleana en texto (p. ej. "CAJA || ADMINISTRADOR") contra los
// permisos y roles de la sesión, sin usar eval. Auto-importado en app y server.

export type AccesoSesion = {
  roles: string[]
  permisos: string[]
}

type AliasTipo = { permiso: string } | { rol: string }

// Alias en MAYÚSCULA que entiende `tieneAcceso`. Cada uno apunta a un permiso
// del modelo (p. ej. 'pos.vender') o a un rol de tienda (p. ej. 'administrador').
// Además de estos alias, también se acepta el código crudo de un permiso o rol.
export const ACCESO_ALIAS: Record<string, AliasTipo> = {
  // Permisos operativos
  VENDER: { permiso: 'pos.vender' },
  CAJA: { permiso: 'caja.abrir' },
  PRODUCTO: { permiso: 'producto.ver' },
  INVENTARIO: { permiso: 'producto.gestionar' },
  COMPRAS: { permiso: 'compra.gestionar' },
  CLIENTES: { permiso: 'cliente.gestionar' },
  REPORTE: { permiso: 'reporte.ver' },
  CONFIG: { permiso: 'configuracion.gestionar' },
  // Roles de tienda
  PROPIETARIO: { rol: 'propietario' },
  ADMINISTRADOR: { rol: 'administrador' },
  CAJERO: { rol: 'cajero' },
  INVENTARIO_ROL: { rol: 'inventario' },
}

// Roles que tienen acceso total a la tienda: no se filtran por permiso puntual.
const ROLES_TOTALES = ['super_admin', 'propietario']

function resolverToken(token: string, sesion: AccesoSesion): boolean {
  const alias = ACCESO_ALIAS[token.toUpperCase()]

  if (!alias) {
    // Sin alias: se permite usar directamente el código de un permiso o rol.
    return sesion.permisos.includes(token) || sesion.roles.includes(token)
  }

  if ('permiso' in alias) {
    return sesion.permisos.includes(alias.permiso)
  }

  return sesion.roles.includes(alias.rol)
}

// Evaluador seguro de expresiones booleanas: soporta || && ! y paréntesis.
// No usa eval: tokeniza la expresión y resuelve cada identificador con `resolver`.
function evaluarExpresion(expr: string, resolver: (token: string) => boolean): boolean {
  const tokens = expr.match(/\(|\)|\|\||&&|!|[A-Za-z0-9_.]+/g) ?? []
  let i = 0

  const peek = () => tokens[i]
  const next = () => tokens[i++]

  function parseOr(): boolean {
    let left = parseAnd()
    while (peek() === '||') {
      next()
      const right = parseAnd()
      left = left || right
    }
    return left
  }

  function parseAnd(): boolean {
    let left = parseNot()
    while (peek() === '&&') {
      next()
      const right = parseNot()
      left = left && right
    }
    return left
  }

  function parseNot(): boolean {
    if (peek() === '!') {
      next()
      return !parseNot()
    }
    return parseAtom()
  }

  function parseAtom(): boolean {
    const token = next()

    if (token === '(') {
      const value = parseOr()
      if (peek() === ')') {
        next()
      }
      return value
    }

    if (token === undefined) {
      return false
    }

    return resolver(token)
  }

  return parseOr()
}

// ¿La sesión cumple la expresión de acceso? Una expresión vacía permite todo.
export function tieneAcceso(expr: string | undefined | null, sesion: AccesoSesion): boolean {
  if (!expr || !expr.trim()) {
    return true
  }

  if (sesion.roles.some(rol => ROLES_TOTALES.includes(rol))) {
    return true
  }

  return evaluarExpresion(expr, token => resolverToken(token, sesion))
}
