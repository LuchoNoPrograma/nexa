<script setup lang="ts">
import 'jspreadsheet-ce/dist/jspreadsheet.css'
import 'jsuites/dist/jsuites.css'
import {
  DIAS_SEMANA,
  HORAS_DIA,
  COLORES_EMPLEADO,
  HORAS_MENSUALES_REFERENCIA,
  SEMANAS_POR_MES,
  slotKey,
  calcularSueldo,
  valorHora,
  type NominaConfig,
} from '~~/shared/utils/nomina'

definePageMeta({
  layout: 'pos',
  posTitle: 'Planilla',
})

useHead({ title: 'Personal y turnos | NEXA' })

type Rol = 'cajero' | 'administrador'
type PagoModo = 'mensual' | 'turno' | 'hora' | 'solo'

type Empleado = {
  id: string
  numero: number
  nombre: string
  puesto: string | null
  color: string
  celular: string | null
  fechaNacimiento: string | null
  direccion: string | null
  rol: Rol | null
  ci: string | null
  tieneLogin: boolean
  valorHora: number | null
  pagoModo: PagoModo
  pagoMonto: number | null
  turnoHoras: number
  fechaAlta: string | null
  fechaBaja: string | null
  slots: Set<string>
}

const cargando = ref(true)
const guardadoMsg = ref('')

const config = reactive<NominaConfig>({
  salarioMinimoMensual: 3300,
  horasMensualesReferencia: HORAS_MENSUALES_REFERENCIA,
  semanasPorMes: SEMANAS_POR_MES,
})

const empleados = ref<Empleado[]>([])

const fmt = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function money(v: number) {
  return `Bs. ${fmt.format(v || 0)}`
}
function moneyShort(v: number) {
  return `Bs ${Math.round(v || 0)}`
}
function fmtHora(hora: number) {
  return `${String(hora).padStart(2, '0')}:00`
}

function fechaLocalISO(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseFecha(value: string | null | undefined) {
  if (!value) {
    return null
  }
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) {
    return null
  }
  return new Date(year, month - 1, day)
}

function formatFecha(value: Date | null) {
  return value ? fechaLocalISO(value) : ''
}

const PAGO_PREFS_KEY = 'nexa:nomina:pago'

function readPagoPrefs(): Record<string, { modo: PagoModo; monto: number | null; turnoHoras: number }> {
  if (!import.meta.client) {
    return {}
  }
  try {
    return JSON.parse(localStorage.getItem(PAGO_PREFS_KEY) || '{}')
  } catch {
    return {}
  }
}

function writePagoPref(emp: Empleado) {
  if (!import.meta.client) {
    return
  }
  const prefs = readPagoPrefs()
  prefs[emp.id] = {
    modo: emp.pagoModo,
    monto: emp.pagoMonto,
    turnoHoras: emp.turnoHoras,
  }
  localStorage.setItem(PAGO_PREFS_KEY, JSON.stringify(prefs))
}

function aEmpleado(row: any): Empleado {
  const rowValorHora = row.valorHora != null ? Number(row.valorHora) : null
  const pagoPref = readPagoPrefs()[row.id]
  const slots = new Set<string>(
    Array.isArray(row.slots) ? row.slots.map((s: any) => slotKey(Number(s.dia), Number(s.hora))) : [],
  )
  return {
    id: row.id,
    numero: Number(row.numero) || 0,
    nombre: row.nombre ?? '',
    puesto: row.puesto ?? null,
    color: row.color || COLORES_EMPLEADO[0],
    celular: row.celular ?? null,
    fechaNacimiento: row.fechaNacimiento ?? null,
    direccion: row.direccion ?? null,
    rol: (row.rol as Rol) ?? null,
    ci: row.ci ?? null,
    tieneLogin: Boolean(row.tieneLogin),
    valorHora: rowValorHora,
    pagoModo: pagoPref?.modo ?? (rowValorHora === 0 ? 'solo' : rowValorHora != null && rowValorHora > 0 ? 'hora' : 'mensual'),
    pagoMonto: pagoPref?.monto ?? (rowValorHora != null && rowValorHora > 0 ? rowValorHora : null),
    turnoHoras: pagoPref?.turnoHoras ?? 8,
    fechaAlta: row.fechaAlta ?? null,
    fechaBaja: row.fechaBaja ?? null,
    slots,
  }
}

// ---------- jspreadsheet (hoja de cálculo por trabajador) ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let jss: any = null
const instancias = new Map<string, any>()
const gridEls = new Map<string, HTMLElement>()
const horariosEnEdicion = reactive(new Set<string>())
const horariosGuardando = reactive(new Set<string>())
const horariosOriginales = new Map<string, Set<string>>()
let activeGridId: string | null = null
let dragStart: { empId: string; x: number; y: number; borrar: boolean } | null = null

function horarioEnEdicion(empId: string) {
  return horariosEnEdicion.has(empId)
}

function habilitarEdicionHorario(emp: Empleado) {
  horariosOriginales.set(emp.id, new Set(emp.slots))
  horariosEnEdicion.add(emp.id)
}

function cancelarEdicionHorario(emp: Empleado) {
  const original = horariosOriginales.get(emp.id)
  if (original) {
    emp.slots.clear()
    original.forEach(slot => emp.slots.add(slot))
    repintar(emp)
  }
  horariosOriginales.delete(emp.id)
  horariosEnEdicion.delete(emp.id)
  limpiarPreview(emp.id)
}

function setGridEl(id: string, el: any) {
  if (el) {
    gridEls.set(id, el as HTMLElement)
  } else {
    gridEls.delete(id)
  }
}

async function cargarLib() {
  if (!jss) {
    jss = (await import('jspreadsheet-ce')).default
  }
  return jss
}

function filasDe() {
  // La hoja es solo visual: la fuente de verdad es emp.slots. Las columnas de
  // día van vacías y se pintan según las horas marcadas.
  return HORAS_DIA.map(hora => [fmtHora(hora), '', '', '', '', '', '', ''])
}

// Pinta/limpia las celdas de día según el set de horas del trabajador.
function repintar(emp: Empleado) {
  const ws = instancias.get(emp.id)
  if (!ws) {
    return
  }
  HORAS_DIA.forEach((hora, y) => {
    DIAS_SEMANA.forEach((d, i) => {
      const cell = ws.getCellFromCoords(i + 1, y)
      if (!cell) {
        return
      }
      const on = emp.slots.has(slotKey(d.idx, hora))
      cell.style.background = on ? emp.color : ''
      cell.classList.toggle('su-on', on)
    })
  })
}

function construirGrid(emp: Empleado) {
  const el = gridEls.get(emp.id)
  if (!el || !jss || instancias.has(emp.id)) {
    return
  }

  const ws = jss(el, {
    worksheets: [{
      data: filasDe(),
      columns: [
        { type: 'text', title: 'HORA', width: 58, readOnly: true, align: 'left' },
        ...DIAS_SEMANA.map(d => ({ type: 'text', title: d.corto, width: 44, align: 'center', readOnly: true })),
      ],
      columnSorting: false,
      columnDrag: false,
      rowDrag: false,
      rowResize: false,
      allowInsertRow: false,
      allowManualInsertRow: false,
      allowInsertColumn: false,
      allowDeleteRow: false,
      allowDeleteColumn: false,
      contextMenu: () => [],
    }],
  })[0]

  ws.hideIndex?.()
  ws.__nexaEmpId = emp.id
  instancias.set(emp.id, ws)
  repintar(emp)
}

function destruirGrid(id: string) {
  const el = gridEls.get(id)
  if (el && jss) {
    jss.destroy(el)
  }
  instancias.delete(id)
}

function aplicarRango(emp: Empleado, fromX: number, fromY: number, toX: number, toY: number, borrar: boolean) {
  if (!horarioEnEdicion(emp.id)) {
    return
  }

  const x1 = Math.max(1, Math.min(fromX, toX))
  const x2 = Math.min(DIAS_SEMANA.length, Math.max(fromX, toX))
  const y1 = Math.max(0, Math.min(fromY, toY))
  const y2 = Math.min(HORAS_DIA.length - 1, Math.max(fromY, toY))
  if (x1 > DIAS_SEMANA.length || x2 < 1 || y1 > HORAS_DIA.length - 1 || y2 < 0) {
    return
  }

  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      const key = slotKey(DIAS_SEMANA[x - 1].idx, HORAS_DIA[y])
      if (borrar) {
        emp.slots.delete(key)
      } else {
        emp.slots.add(key)
      }
    }
  }

  instancias.get(emp.id)?.resetSelection?.()
  repintar(emp)
}

function limpiarPreview(empId?: string) {
  const ids = empId ? [empId] : [...gridEls.keys()]
  ids.forEach((id) => {
    gridEls.get(id)?.querySelectorAll('.su-preview-on, .su-preview-off').forEach((cell) => {
      cell.classList.remove('su-preview-on', 'su-preview-off')
    })
  })
}

function previsualizarRango(emp: Empleado, fromX: number, fromY: number, toX: number, toY: number, borrar: boolean) {
  const ws = instancias.get(emp.id)
  if (!ws) {
    return
  }

  limpiarPreview(emp.id)

  const x1 = Math.max(1, Math.min(fromX, toX))
  const x2 = Math.min(DIAS_SEMANA.length, Math.max(fromX, toX))
  const y1 = Math.max(0, Math.min(fromY, toY))
  const y2 = Math.min(HORAS_DIA.length - 1, Math.max(fromY, toY))
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      ws.getCellFromCoords(x, y)?.classList.add(borrar ? 'su-preview-off' : 'su-preview-on')
    }
  }
}

// Fallback para selecciones hechas por jspreadsheet cuando no tenemos una
// celda inicial capturada, por ejemplo interacciones raras del navegador.
function aplicarSeleccion(emp: Empleado) {
  if (!horarioEnEdicion(emp.id)) {
    return
  }

  const ws = instancias.get(emp.id)
  if (!ws) {
    return
  }
  const sel = ws.getSelection?.()
  if (!sel || sel.length < 4) {
    return
  }
  const x1 = Math.max(1, Math.min(sel[0], sel[2]))
  const y1 = Math.max(0, Math.min(sel[1], sel[3]))
  const anchorKey = slotKey(DIAS_SEMANA[x1 - 1].idx, HORAS_DIA[y1])
  aplicarRango(emp, sel[0], sel[1], sel[2], sel[3], emp.slots.has(anchorKey))
}

function gridIdFromTarget(target: Node | null) {
  if (!target) {
    return null
  }
  for (const [empId, el] of gridEls) {
    if (el.contains(target)) {
      return empId
    }
  }
  return null
}

function coordsFromTarget(empId: string, target: Node | null) {
  if (!(target instanceof Element)) {
    return null
  }
  const grid = gridEls.get(empId)
  const cell = target.closest('td')
  const row = cell?.parentElement
  const body = row?.parentElement
  if (!grid || !cell || !row || body?.tagName !== 'TBODY' || !grid.contains(cell)) {
    return null
  }
  const x = Number(cell.getAttribute('data-x'))
  const y = Number(cell.getAttribute('data-y') ?? (row as HTMLTableRowElement).sectionRowIndex)
  if (x < 1 || x > DIAS_SEMANA.length || y < 0 || y >= HORAS_DIA.length) {
    return null
  }
  return { x, y }
}

function onDocPointerDown(e: PointerEvent) {
  activeGridId = gridIdFromTarget(e.target as Node)
  dragStart = null

  if (!activeGridId) {
    return
  }

  const coords = coordsFromTarget(activeGridId, e.target as Node)
  if (!coords) {
    return
  }

  const emp = empleados.value.find(x => x.id === activeGridId)
  if (!emp || !horarioEnEdicion(emp.id)) {
    activeGridId = null
    return
  }

  const key = slotKey(DIAS_SEMANA[coords.x - 1].idx, HORAS_DIA[coords.y])
  dragStart = { empId: activeGridId, x: coords.x, y: coords.y, borrar: emp.slots.has(key) }
  previsualizarRango(emp, coords.x, coords.y, coords.x, coords.y, dragStart.borrar)
}

function onDocPointerMove(e: PointerEvent) {
  if (!dragStart) {
    return
  }

  const emp = empleados.value.find(x => x.id === dragStart?.empId)
  if (!emp) {
    return
  }

  const target = document.elementFromPoint(e.clientX, e.clientY)
  const end = coordsFromTarget(dragStart.empId, target)
  if (end) {
    previsualizarRango(emp, dragStart.x, dragStart.y, end.x, end.y, dragStart.borrar)
  }
}

function onDocPointerUp(e: PointerEvent) {
  if (!jss) {
    activeGridId = null
    dragStart = null
    limpiarPreview()
    return
  }

  const empId = activeGridId ?? gridIdFromTarget(e.target as Node)
  activeGridId = null
  if (!empId) {
    dragStart = null
    limpiarPreview()
    return
  }

  const emp = empleados.value.find(x => x.id === empId)
  if (!emp || !horarioEnEdicion(emp.id)) {
    dragStart = null
    limpiarPreview(empId)
    return
  }

  if (dragStart?.empId === empId) {
    const endTarget = document.elementFromPoint(e.clientX, e.clientY) ?? (e.target as Element | null)
    const end = coordsFromTarget(empId, endTarget) ?? coordsFromTarget(empId, e.target as Node)
    if (end) {
      limpiarPreview(empId)
      aplicarRango(emp, dragStart.x, dragStart.y, end.x, end.y, dragStart.borrar)
      dragStart = null
      return
    }
  }

  dragStart = null
  limpiarPreview(empId)
  // Espera a que jspreadsheet finalice su propia selección del mouseup.
  setTimeout(() => aplicarSeleccion(emp), 0)
}

function onDocPointerCancel() {
  activeGridId = null
  dragStart = null
  limpiarPreview()
}

async function construirTodos() {
  await cargarLib()
  await nextTick()
  for (const emp of empleados.value) {
    construirGrid(emp)
  }
}

onMounted(async () => {
  try {
    const data = await $fetch<{ config: NominaConfig; empleados: any[] }>('/api/pos/nomina')
    if (data.config) {
      Object.assign(config, data.config)
      // Las horas de referencia se derivan de la jornada legal (48 h/semana),
      // no del valor histórico que pudiera tener la BD (p. ej. 240).
      config.horasMensualesReferencia = HORAS_MENSUALES_REFERENCIA
      config.semanasPorMes = SEMANAS_POR_MES
    }
    empleados.value = (data.empleados ?? []).map(aEmpleado)

  } catch {
    // Sin datos: se queda con la config por defecto.
  } finally {
    cargando.value = false
  }

  await construirTodos()
  document.addEventListener('pointerdown', onDocPointerDown, true)
  document.addEventListener('pointermove', onDocPointerMove)
  document.addEventListener('pointerup', onDocPointerUp)
  document.addEventListener('pointercancel', onDocPointerCancel)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('pointermove', onDocPointerMove)
  document.removeEventListener('pointerup', onDocPointerUp)
  document.removeEventListener('pointercancel', onDocPointerCancel)
  for (const id of [...instancias.keys()]) {
    destruirGrid(id)
  }
  for (const timer of nombreTimers.values()) {
    clearTimeout(timer)
  }
  nombreTimers.clear()
})

// ---------- Cálculos derivados ----------
const valorHoraActual = computed(() => valorHora(config))

function horasMensualesEmp(emp: Empleado) {
  return emp.slots.size * config.semanasPorMes
}

function valorHoraEmpleado(emp: Empleado) {
  if (emp.pagoModo === 'solo') {
    return 0
  }
  if (emp.pagoModo === 'mensual') {
    const monto = emp.pagoMonto != null && emp.pagoMonto > 0 ? emp.pagoMonto : config.salarioMinimoMensual
    return config.horasMensualesReferencia > 0 ? monto / config.horasMensualesReferencia : 0
  }
  if (emp.pagoModo === 'turno') {
    const monto = emp.pagoMonto != null && emp.pagoMonto > 0 ? emp.pagoMonto : 0
    return emp.turnoHoras > 0 ? monto / emp.turnoHoras : 0
  }
  if (emp.valorHora != null && emp.valorHora > 0) {
    return emp.valorHora
  }
  return emp.pagoMonto != null && emp.pagoMonto > 0 ? emp.pagoMonto : valorHoraActual.value
}

function pagoResumen(emp: Empleado) {
  if (emp.pagoModo === 'solo') {
    return 'Solo horario'
  }
  if (emp.pagoModo === 'mensual') {
    const monto = emp.pagoMonto != null && emp.pagoMonto > 0 ? emp.pagoMonto : config.salarioMinimoMensual
    return `${moneyShort(monto)} al mes`
  }
  if (emp.pagoModo === 'turno') {
    return `${moneyShort(emp.pagoMonto || 0)} por turno`
  }
  return `${moneyShort(valorHoraEmpleado(emp))} por hora`
}

function costoMensual(emp: Empleado) {
  return emp.pagoModo === 'solo' ? 0 : valorHoraEmpleado(emp) * horasMensualesEmp(emp)
}

const filas = computed(() =>
  empleados.value.map((emp) => {
    const calc = calcularSueldo(emp.slots.size, config, valorHoraEmpleado(emp))
    return {
      id: emp.id,
      etiqueta: `Empleado ${emp.numero}`,
      nombre: emp.nombre,
      color: emp.color,
      horasSemanales: calc.horasSemanales,
      horasMensuales: calc.horasMensuales,
      valorHora: valorHoraEmpleado(emp),
      valorHoraPropio: emp.pagoModo !== 'mensual' && emp.pagoModo !== 'solo',
      pago: pagoResumen(emp),
      sueldoMensual: costoMensual(emp),
    }
  }),
)

const totalSueldos = computed(() => filas.value.reduce((s, f) => s + f.sueldoMensual, 0))
const totalHorasSemanales = computed(() => empleados.value.reduce((s, emp) => s + emp.slots.size, 0))

// ---------- Persistencia ----------
async function guardarHorario(emp: Empleado) {
  const slots = [...emp.slots].map((key) => {
    const [dia, hora] = key.split('-').map(Number)
    return { dia, hora }
  })
  await $fetch(`/api/pos/nomina/empleados/${emp.id}/horario`, { method: 'PUT', body: { slots } })
}

async function confirmarHorario(emp: Empleado) {
  if (horariosGuardando.has(emp.id)) {
    return
  }

  horariosGuardando.add(emp.id)
  try {
    await guardarHorario(emp)
    horariosOriginales.delete(emp.id)
    horariosEnEdicion.delete(emp.id)
    flash('Horario guardado')
  } catch {
    flash('No se pudo guardar el horario')
  } finally {
    horariosGuardando.delete(emp.id)
  }
}

async function guardarPago(emp: Empleado) {
  emp.valorHora = valorHoraEmpleado(emp)
  writePagoPref(emp)
  await $fetch(`/api/pos/nomina/empleados/${emp.id}`, {
    method: 'PUT',
    body: { valorHora: emp.pagoModo === 'solo' ? 0 : emp.valorHora },
  }).catch(() => null)
}

function setPagoModo(emp: Empleado, modo: PagoModo) {
  const anterior = emp.pagoModo
  emp.pagoModo = modo
  if (modo === 'mensual' && (anterior !== modo || emp.pagoMonto == null || emp.pagoMonto <= 0)) {
    emp.pagoMonto = config.salarioMinimoMensual
  }
  if (modo === 'turno' && (anterior !== modo || emp.pagoMonto == null || emp.pagoMonto <= 0)) {
    emp.pagoMonto = 80
    emp.turnoHoras = emp.turnoHoras || 8
  }
  if (modo === 'hora' && (anterior !== modo || emp.pagoMonto == null || emp.pagoMonto <= 0)) {
    emp.pagoMonto = Math.round(valorHoraActual.value)
    emp.valorHora = emp.pagoMonto
  }
  void guardarPago(emp)
}

function onPagoMonto(emp: Empleado) {
  if (emp.pagoModo === 'hora') {
    emp.valorHora = emp.pagoMonto
  }
  void guardarPago(emp)
}

function marcarRango(emp: Empleado, dias: number[], inicio: number, finExclusivo: number) {
  dias.forEach((dia) => {
    HORAS_DIA.forEach((hora) => {
      const key = slotKey(dia, hora)
      if (hora >= inicio && hora < finExclusivo) {
        emp.slots.add(key)
      }
    })
  })
  repintar(emp)
}

function aplicarHorarioRapido(emp: Empleado, tipo: 'manana' | 'dia' | 'sabado') {
  if (!horarioEnEdicion(emp.id)) {
    return
  }

  emp.slots.clear()
  if (tipo === 'manana') {
    marcarRango(emp, [1, 2, 3, 4, 5], 8, 12)
  } else if (tipo === 'dia') {
    marcarRango(emp, [1, 2, 3, 4, 5, 6], 8, 17)
  } else {
    marcarRango(emp, [6, 0], 8, 14)
  }
  flash('Horario ajustado. Presiona Guardar para confirmar.')
}

const nombreTimers = new Map<string, ReturnType<typeof setTimeout>>()
function onNombre(emp: Empleado) {
  const actual = nombreTimers.get(emp.id)
  if (actual) {
    clearTimeout(actual)
  }
  nombreTimers.set(emp.id, setTimeout(() => {
    void $fetch(`/api/pos/nomina/empleados/${emp.id}`, { method: 'PUT', body: { nombre: emp.nombre } }).catch(() => null)
    nombreTimers.delete(emp.id)
  }, 500))
}

async function crearEmpleadoDesdeDialog() {
  try {
    const { empleado: creado } = await $fetch<{ empleado: any }>('/api/pos/nomina/empleados', {
      method: 'POST',
      body: {
        nombre: editForm.nombre.trim(),
        puesto: editForm.puesto.trim(),
        celular: editForm.celular.trim(),
        fechaNacimiento: formatFecha(editForm.fechaNacimiento),
        direccion: editForm.direccion.trim(),
        fechaAlta: formatFecha(editForm.fechaAlta),
      },
    })
    const data = { empleado: creado }
    const emp = aEmpleado(data.empleado)
    empleados.value.push(emp)
    let accesoFallido = false

    if (editForm.rol) {
      try {
        const acceso = await $fetch<{ rol: Rol | null; ci: string | null; tieneLogin: boolean }>(
          `/api/pos/nomina/empleados/${emp.id}/acceso`,
          {
            method: 'PUT',
            body: {
              rol: editForm.rol,
              ci: editForm.ci.trim(),
              password: editForm.password.trim(),
            },
          },
        )
        emp.rol = acceso.rol
        emp.ci = acceso.ci
        emp.tieneLogin = acceso.tieneLogin
      } catch {
        accesoFallido = true
      }
    }

    if (jss) {
      await nextTick()
      construirGrid(emp)
    }
    editVisible.value = false
    flash(accesoFallido ? 'Empleado agregado. Revisa el acceso luego.' : 'Empleado agregado')
    await nextTick()
    document.getElementById(`emp-card-${emp.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch {
    infoError.value = 'No se pudo agregar el empleado.'
  }
}

async function eliminarEmpleado(emp: Empleado) {
  const ok = await confirmarAccion({
    titulo: `¿Eliminar a ${emp.nombre || 'este empleado'}?`,
    texto: 'Se borrará su planilla de horas. Esta acción no se puede deshacer.',
    confirmar: 'Sí, eliminar',
    cancelar: 'Cancelar',
    peligro: true,
  })
  if (!ok) {
    return
  }
  destruirGrid(emp.id)
  horariosEnEdicion.delete(emp.id)
  horariosGuardando.delete(emp.id)
  horariosOriginales.delete(emp.id)
  await $fetch(`/api/pos/nomina/empleados/${emp.id}`, { method: 'DELETE' }).catch(() => null)
  if (import.meta.client) {
    const prefs = readPagoPrefs()
    delete prefs[emp.id]
    localStorage.setItem(PAGO_PREFS_KEY, JSON.stringify(prefs))
  }
  empleados.value = empleados.value.filter(e => e.id !== emp.id)
}

// ---------- Modal: editar info de contacto + acceso (rol) ----------
const editVisible = ref(false)
const editEmp = ref<Empleado | null>(null)
const guardandoInfo = ref(false)
const infoError = ref('')

const ROLES_OPCIONES = [
  { label: 'Sin acceso', value: '' },
  { label: 'Cajero (Caja y Ventas)', value: 'cajero' },
  { label: 'Administrador (acceso completo)', value: 'administrador' },
]

const editForm = reactive({
  nombre: '',
  puesto: '',
  celular: '',
  fechaNacimiento: null as Date | null,
  direccion: '',
  fechaAlta: parseFecha(fechaLocalISO()) as Date | null,
  rol: '' as '' | Rol,
  ci: '',
  password: '',
})

// ¿El rol elegido necesita credenciales nuevas? (empleado sin login aún)
const requiereCredenciales = computed(() => Boolean(editForm.rol) && !editEmp.value?.tieneLogin)

function resetEditForm() {
  infoError.value = ''
  editForm.nombre = ''
  editForm.puesto = ''
  editForm.celular = ''
  editForm.fechaNacimiento = null
  editForm.direccion = ''
  editForm.fechaAlta = parseFecha(fechaLocalISO())
  editForm.rol = ''
  editForm.ci = ''
  editForm.password = ''
}

function abrirCrearEmpleado() {
  editEmp.value = null
  resetEditForm()
  editVisible.value = true
}

function abrirEditar(emp: Empleado) {
  editEmp.value = emp
  infoError.value = ''
  editForm.nombre = emp.nombre
  editForm.puesto = emp.puesto ?? ''
  editForm.celular = emp.celular ?? ''
  editForm.fechaNacimiento = parseFecha(emp.fechaNacimiento)
  editForm.direccion = emp.direccion ?? ''
  editForm.fechaAlta = parseFecha(emp.fechaAlta) ?? parseFecha(fechaLocalISO())
  editForm.rol = emp.rol ?? ''
  editForm.ci = emp.ci ?? ''
  editForm.password = ''
  editVisible.value = true
}

async function guardarInfo() {
  const emp = editEmp.value

  infoError.value = ''

  if (!editForm.nombre.trim()) {
    infoError.value = 'Ingresa el nombre del empleado.'
    return
  }

  // Validación de credenciales cuando se asigna acceso por primera vez.
  if (requiereCredenciales.value) {
    if (!editForm.ci.trim()) {
      infoError.value = 'Ingresa el CI para crear el acceso del empleado.'
      return
    }
    if (editForm.password.trim().length < 4) {
      infoError.value = 'La contraseña debe tener al menos 4 caracteres.'
      return
    }
  }

  guardandoInfo.value = true

  try {
    if (!emp) {
      await crearEmpleadoDesdeDialog()
      return
    }

    // 1) Datos de contacto.
    const { empleado: actualizado } = await $fetch<{ empleado: any }>(`/api/pos/nomina/empleados/${emp.id}`, {
      method: 'PUT',
      body: {
        nombre: editForm.nombre.trim(),
        puesto: editForm.puesto.trim(),
        celular: editForm.celular.trim(),
        fechaNacimiento: formatFecha(editForm.fechaNacimiento),
        direccion: editForm.direccion.trim(),
        fechaAlta: formatFecha(editForm.fechaAlta),
      },
    })

    emp.nombre = actualizado.nombre ?? emp.nombre
    emp.puesto = actualizado.puesto ?? null
    emp.celular = actualizado.celular ?? null
    emp.fechaNacimiento = actualizado.fechaNacimiento ?? null
    emp.direccion = actualizado.direccion ?? null
    emp.valorHora = actualizado.valorHora != null ? Number(actualizado.valorHora) : null
    emp.fechaAlta = actualizado.fechaAlta ?? null

    // 2) Acceso (rol + login), solo si cambió el rol o se enviaron credenciales.
    const rolCambio = (editForm.rol || '') !== (emp.rol ?? '')
    const credencialesNuevas = Boolean(editForm.rol) && (editForm.password.trim() || editForm.ci.trim() !== (emp.ci ?? ''))

    if (rolCambio || credencialesNuevas) {
      const acceso = await $fetch<{ rol: Rol | null; ci: string | null; tieneLogin: boolean }>(
        `/api/pos/nomina/empleados/${emp.id}/acceso`,
        {
          method: 'PUT',
          body: {
            rol: editForm.rol || null,
            ci: editForm.ci.trim() || undefined,
            password: editForm.password.trim() || undefined,
          },
        },
      )
      emp.rol = acceso.rol
      emp.ci = acceso.ci
      emp.tieneLogin = acceso.tieneLogin
    }

    editVisible.value = false
    flash('Datos guardados')
  } catch (error: any) {
    infoError.value = error?.statusMessage || error?.data?.statusMessage || 'No se pudieron guardar los datos.'
  } finally {
    guardandoInfo.value = false
  }
}

function rolLabel(rol: Rol | null) {
  if (rol === 'cajero') {
    return 'Cajero'
  }
  if (rol === 'administrador') {
    return 'Administrador'
  }
  return null
}

function flash(msg: string) {
  guardadoMsg.value = msg
  setTimeout(() => {
    if (guardadoMsg.value === msg) {
      guardadoMsg.value = ''
    }
  }, 2500)
}
</script>

<template>
  <div class="sueldos">
    <!-- Encabezado -->
    <header class="su-header">
      <div>
        <nav class="su-crumbs" aria-label="Ruta de planilla">
          <NuxtLink to="/pos/inicio">Inicio</NuxtLink>
          <i class="pi pi-angle-right" aria-hidden="true" />
          <strong>Personal</strong>
        </nav>
        <h1>Personal y turnos</h1>
        <p>Define cómo le pagas a cada persona y marca cuándo trabaja. NEXA calcula horas, valor hora y costo mensual estimado.</p>
      </div>
    </header>

    <div v-if="cargando" class="su-loading">
      <span class="su-spinner" aria-hidden="true" /> Cargando…
    </div>

    <template v-else>
      <section class="su-overview" aria-label="Resumen de personal">
        <article>
          <span>Personas</span>
          <strong>{{ empleados.length }}</strong>
        </article>
        <article>
          <span>Horas semanales</span>
          <strong>{{ totalHorasSemanales }} h</strong>
        </article>
        <article>
          <span>Costo mensual estimado</span>
          <strong>{{ money(totalSueldos) }}</strong>
        </article>
      </section>

      <!-- 1. Hojas de cálculo por trabajador -->
      <section>
        <div class="su-section-head">
        <h2>1. Empleados, pago y turnos</h2>
          <Button type="button" icon="pi pi-plus" label="Agregar empleado" @click="abrirCrearEmpleado" />
        </div>
        <p class="su-section-sub">Primero elige cómo le pagas. Luego usa un horario rápido o pinta horas en la semana.</p>

        <div class="su-grid">
          <article
            v-for="emp in empleados"
            :id="`emp-card-${emp.id}`"
            :key="emp.id"
            class="su-card"
            :style="{ '--c': emp.color }"
          >
            <header class="su-card__head">
              <span class="su-card__tag">Empleado {{ emp.numero }}</span>
              <input v-model="emp.nombre" class="su-card__name" placeholder="Nombre del empleado" @input="onNombre(emp)">
              <button type="button" class="su-card__edit" title="Editar datos y acceso" @click="abrirEditar(emp)">
                <i class="pi pi-user-edit" />
              </button>
              <button type="button" class="su-card__del" title="Eliminar" @click="eliminarEmpleado(emp)">
                <i class="pi pi-trash" />
              </button>
            </header>

            <div v-if="emp.rol || emp.celular" class="su-card__meta">
              <span v-if="rolLabel(emp.rol)" class="su-badge" :class="`su-badge--${emp.rol}`">
                <i class="pi pi-id-card" /> {{ rolLabel(emp.rol) }}
                <small v-if="emp.ci">· CI {{ emp.ci }}</small>
              </span>
              <span v-if="emp.celular" class="su-badge su-badge--muted">
                <i class="pi pi-phone" /> {{ emp.celular }}
              </span>
            </div>

            <section class="su-pay">
              <div class="su-pay__head">
                <span>Cómo le pagas</span>
                <strong>{{ pagoResumen(emp) }}</strong>
              </div>
              <div class="su-pay__modes" aria-label="Tipo de pago">
                <button type="button" :class="{ 'is-active': emp.pagoModo === 'mensual' }" @click="setPagoModo(emp, 'mensual')">
                  Mensual
                </button>
                <button type="button" :class="{ 'is-active': emp.pagoModo === 'turno' }" @click="setPagoModo(emp, 'turno')">
                  Por turno
                </button>
                <button type="button" :class="{ 'is-active': emp.pagoModo === 'hora' }" @click="setPagoModo(emp, 'hora')">
                  Por hora
                </button>
                <button type="button" :class="{ 'is-active': emp.pagoModo === 'solo' }" @click="setPagoModo(emp, 'solo')">
                  Solo horario
                </button>
              </div>

              <div v-if="emp.pagoModo !== 'solo'" class="su-pay__fields">
                <label class="su-pay__field">
                  <span>
                    {{ emp.pagoModo === 'mensual' ? 'Sueldo mensual' : emp.pagoModo === 'turno' ? 'Pago por turno' : 'Pago por hora' }}
                  </span>
                  <InputNumber
                    v-model="emp.pagoMonto"
                    mode="decimal"
                    :min="0"
                    :max-fraction-digits="2"
                    fluid
                    @update:model-value="onPagoMonto(emp)"
                  />
                </label>
                <label v-if="emp.pagoModo === 'turno'" class="su-pay__field">
                  <span>Horas del turno</span>
                  <InputNumber
                    v-model="emp.turnoHoras"
                    mode="decimal"
                    :min="1"
                    :max="16"
                    :max-fraction-digits="1"
                    fluid
                    @update:model-value="onPagoMonto(emp)"
                  />
                </label>
                <div class="su-pay__result">
                  <span>Valor hora estimado</span>
                  <strong>{{ money(valorHoraEmpleado(emp)) }}</strong>
                </div>
              </div>

              <p v-else class="su-pay__note">Usa esta opción si solo quieres organizar turnos sin calcular sueldo.</p>
            </section>

            <section class="su-quick">
              <span>Horarios rápidos</span>
              <div>
                <button type="button" :disabled="!horarioEnEdicion(emp.id)" @click="aplicarHorarioRapido(emp, 'manana')">Lun-Vie mañana</button>
                <button type="button" :disabled="!horarioEnEdicion(emp.id)" @click="aplicarHorarioRapido(emp, 'dia')">Lun-Sáb día</button>
                <button type="button" :disabled="!horarioEnEdicion(emp.id)" @click="aplicarHorarioRapido(emp, 'sabado')">Fin de semana</button>
              </div>
            </section>

            <div class="su-schedule-head">
              <span>
                <i :class="horarioEnEdicion(emp.id) ? 'pi pi-pencil' : 'pi pi-lock'" />
                {{ horarioEnEdicion(emp.id) ? 'Editando horario' : 'Horario protegido' }}
              </span>
              <div>
                <Button
                  v-if="!horarioEnEdicion(emp.id)"
                  type="button"
                  label="Editar horario"
                  icon="pi pi-pencil"
                  size="small"
                  outlined
                  @click="habilitarEdicionHorario(emp)"
                />
                <template v-else>
                  <Button
                    type="button"
                    label="Cancelar"
                    size="small"
                    severity="secondary"
                    text
                    :disabled="horariosGuardando.has(emp.id)"
                    @click="cancelarEdicionHorario(emp)"
                  />
                  <Button
                    type="button"
                    label="Guardar"
                    icon="pi pi-save"
                    size="small"
                    :loading="horariosGuardando.has(emp.id)"
                    @click="confirmarHorario(emp)"
                  />
                </template>
              </div>
            </div>

            <div class="su-jss-wrap" :class="{ 'is-editing': horarioEnEdicion(emp.id) }">
              <div :ref="el => setGridEl(emp.id, el)" class="su-jss" />
            </div>

            <footer class="su-card__foot">
              <span class="su-card__metric">
                <span>Horas semanales:</span>
                <strong :style="{ color: emp.color }">{{ emp.slots.size }} h</strong>
              </span>
              <span class="su-card__metric">
                <span>Estimado mensual:</span>
                <strong class="su-card__cost">{{ money(costoMensual(emp)) }}</strong>
              </span>
            </footer>
          </article>

          <!-- Tarjeta para agregar un nuevo trabajador (estilo Google) -->
          <button type="button" class="su-card su-card--add" @click="abrirCrearEmpleado">
            <span class="su-card-add__icon"><i class="pi pi-plus" /></span>
            <strong>Agregar empleado</strong>
            <small>Completa sus datos antes de crear la planilla</small>
          </button>
        </div>

        <p class="su-hint"><i class="pi pi-info-circle" /> Presiona «Editar horario» antes de marcar celdas. En modo protegido puedes desplazarte sin cambiar la planilla.</p>
      </section>

      <!-- 2. Resumen -->
      <section id="resumen" class="su-summary">
        <h2>2. Pagos estimados</h2>
        <p class="su-section-sub">El valor hora queda como cálculo interno para comparar personal y medir el costo real de cada turno.</p>

        <div class="su-summary__body">
          <div class="su-table-wrap">
            <table class="su-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th class="num">Total horas semanales</th>
                  <th class="num">Total horas mensuales<small>(aprox. {{ config.semanasPorMes }} semanas)</small></th>
                  <th class="num">Pago configurado</th>
                  <th class="num">Valor hora estimado</th>
                  <th class="num">Costo mensual estimado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="f in filas" :key="f.id">
                  <td>
                    <span class="su-dot" :style="{ background: f.color }" />
                    {{ f.nombre || f.etiqueta }}
                  </td>
                  <td class="num">{{ f.horasSemanales }} h</td>
                  <td class="num">{{ Math.round(f.horasMensuales) }} h</td>
                  <td class="num">{{ f.pago }}</td>
                  <td class="num">
                    {{ money(f.valorHora) }}
                    <small v-if="f.valorHoraPropio" class="su-tag-propio">propio</small>
                  </td>
                  <td class="num strong">{{ money(f.sueldoMensual) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5">Costo laboral mensual estimado</td>
                  <td class="num strong total">{{ money(totalSueldos) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      <p class="su-note">
        <i class="pi pi-lightbulb" /> Los pagos se actualizan al instante; los horarios se confirman con el botón Guardar.
        Los cálculos son aproximados: no reemplazan una planilla legal de nómina.
      </p>
    </template>

    <!-- Aviso flotante de guardado/acciones -->
    <Transition name="su-toast">
      <div v-if="guardadoMsg" class="su-toast"><i class="pi pi-check-circle" /> {{ guardadoMsg }}</div>
    </Transition>

    <!-- Modal: datos de contacto + acceso (rol) del empleado -->
    <Dialog
      v-model:visible="editVisible"
      modal
      :header="editEmp ? `Empleado ${editEmp.numero}` : 'Agregar empleado'"
      class="su-dialog"
      :style="{ width: '620px' }"
      :breakpoints="{ '760px': '94vw', '420px': '98vw' }"
    >
      <div class="su-form">
        <section class="su-form__block su-form__block--primary">
          <div class="su-form__block-head">
            <span>1</span>
            <div>
              <strong>Datos básicos</strong>
              <small>Solo el nombre es obligatorio.</small>
            </div>
          </div>

          <div class="su-form__field">
            <label>Nombre completo</label>
            <InputText v-model="editForm.nombre" fluid autofocus />
          </div>

          <div class="su-form__row">
            <div class="su-form__field">
              <label>Puesto</label>
              <InputText v-model="editForm.puesto" fluid />
            </div>
            <div class="su-form__field">
              <label>Fecha de ingreso</label>
              <DatePicker v-model="editForm.fechaAlta" show-icon fluid />
            </div>
          </div>
        </section>

        <section class="su-form__block">
          <div class="su-form__block-head">
            <span>2</span>
            <div>
              <strong>Contacto</strong>
              <small>Opcional, útil para identificar al empleado.</small>
            </div>
          </div>

          <div class="su-form__row">
            <div class="su-form__field">
              <label>Celular</label>
              <SharedPhoneCountryInput
                v-model="editForm.celular"
                input-id="empleado-celular"
                name="empleado-celular"
                autocomplete="tel"
              />
            </div>
            <div class="su-form__field">
              <label>Fecha de nacimiento</label>
              <DatePicker v-model="editForm.fechaNacimiento" show-icon fluid show-clear />
            </div>
          </div>

          <div class="su-form__field">
            <label>Dirección</label>
            <InputText v-model="editForm.direccion" fluid />
          </div>
        </section>

        <section class="su-form__block">
          <div class="su-form__block-head">
            <span>3</span>
            <div>
              <strong>Acceso al sistema</strong>
              <small>Déjalo sin acceso si solo quieres registrar turnos.</small>
            </div>
          </div>

          <div class="su-form__field">
            <label>Rol</label>
            <Select v-model="editForm.rol" :options="ROLES_OPCIONES" option-label="label" option-value="value" fluid />
          </div>

          <div v-if="editForm.rol" class="su-form__access">
            <div class="su-form__row">
              <div class="su-form__field">
                <label>CI</label>
                <InputText v-model="editForm.ci" fluid />
              </div>
              <div class="su-form__field">
                <label>{{ editEmp?.tieneLogin ? 'Nueva contraseña' : 'Crear contraseña' }}</label>
                <InputText v-model="editForm.password" type="password" fluid />
              </div>
            </div>
            <p class="su-form__hint" :class="{ 'su-form__hint--ok': editEmp?.tieneLogin }">
              <i :class="editEmp?.tieneLogin ? 'pi pi-check-circle' : 'pi pi-info-circle'" />
              {{ editEmp?.tieneLogin ? 'Ya tiene acceso. La contraseña puede quedar vacía si no la cambiarás.' : 'La contraseña debe tener al menos 4 caracteres.' }}
            </p>
          </div>
        </section>

        <p v-if="infoError" class="su-form__error"><i class="pi pi-exclamation-triangle" /> {{ infoError }}</p>
      </div>

      <template #footer>
        <Button type="button" label="Cancelar" outlined severity="secondary" @click="editVisible = false" />
        <Button type="button" :label="editEmp ? 'Guardar' : 'Crear empleado'" :loading="guardandoInfo" @click="guardarInfo" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.sueldos {
  display: grid;
  gap: 22px;
  max-width: 1100px;
  margin: 0 auto;
  color: #102016;
}

/* ---------- Encabezado ---------- */
.su-header {
  display: block;
}

.su-crumbs {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #5d6b61;
  font-size: 0.8rem;
  font-weight: 800;
}

.su-crumbs a {
  color: inherit;
  text-decoration: none;
}

.su-crumbs a:hover {
  color: #0a6f1f;
}

.su-crumbs i {
  color: #9aa8a0;
  font-size: 0.7rem;
}

.su-crumbs strong {
  color: #0f172a;
}

.su-header h1 {
  margin: 8px 0 6px;
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: clamp(1.4rem, 2.4vw, 1.9rem);
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #0d2b5e;
}

.su-header > div > p {
  margin: 0;
  max-width: 56ch;
  color: #5d6b61;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.5;
}

.su-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.su-overview article {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid #e7eee8;
  border-radius: 14px;
  background: #ffffff;
}

.su-overview span {
  color: #6b7a6f;
  font-size: 0.76rem;
  font-weight: 800;
}

.su-overview strong {
  color: #0d2b5e;
  font-size: 1.18rem;
  font-weight: 950;
}

/* ---------- Secciones ---------- */
.su-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.su-section-head h2,
.su-summary h2 {
  margin: 0;
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: 1.05rem;
  font-weight: 900;
}

.su-section-sub {
  margin: 4px 0 14px;
  color: #6b7a6f;
  font-size: 0.84rem;
  font-weight: 600;
}

/* ---------- Tarjetas de trabajador ---------- */
.su-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.su-card {
  border: 1px solid #e7eee8;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

/* Tarjeta "+ Agregar empleado": ocupa el hueco libre del grid. */
.su-card--add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 200px;
  padding: 24px;
  border: 2px dashed #cfe3c6;
  background: #f7fbf6;
  box-shadow: none;
  color: #1c7a2c;
  cursor: pointer;
  text-align: center;
  transition: background 0.15s, border-color 0.15s;
}

.su-card--add:hover {
  background: #eaf6e7;
  border-color: #0b6f38;
}

.su-card-add__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #eaf6e7;
  color: #1c7a2c;
  font-size: 1.2rem;
}

.su-card--add:hover .su-card-add__icon {
  background: #fff;
}

.su-card--add strong {
  font-size: 0.92rem;
  font-weight: 900;
}

.su-card--add small {
  font-size: 0.76rem;
  font-weight: 600;
  color: #6b7a6f;
}

.su-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #eff4ef;
}

.su-card__tag {
  font-size: 0.82rem;
  font-weight: 900;
  color: var(--c);
  white-space: nowrap;
}

.su-card__name {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid #e3e9e3;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  outline: none;
}

.su-card__name:focus {
  border-color: var(--c);
}

.su-card__del,
.su-card__edit {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

.su-card__edit {
  background: #eef2fb;
  color: #2f5fd0;
}

.su-card__del {
  background: #fde8e8;
  color: #dc2626;
}

/* Chips de rol/contacto debajo de la cabecera de la tarjeta. */
.su-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 14px 4px;
}

.su-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 800;
}

.su-badge small {
  font-weight: 700;
  opacity: 0.8;
}

.su-badge--cajero {
  background: #eef2fb;
  color: #2f5fd0;
}

.su-badge--administrador {
  background: #f3eafe;
  color: #7c3aed;
}

.su-badge--muted {
  background: #f1f5f1;
  color: #5d6b61;
}

.su-pay {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #eff4ef;
  background: #fbfdfb;
}

.su-pay__head,
.su-quick {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.su-pay__head span,
.su-quick > span {
  color: #41617f;
  font-size: 0.75rem;
  font-weight: 900;
}

.su-pay__head strong {
  color: #102016;
  font-size: 0.82rem;
  font-weight: 900;
}

.su-pay__modes {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.su-pay__modes button,
.su-quick button {
  min-height: 34px;
  border: 1px solid #dfe8df;
  border-radius: 8px;
  background: #fff;
  color: #41514a;
  font-size: 0.72rem;
  font-weight: 850;
  cursor: pointer;
}

.su-pay__modes button.is-active {
  border-color: var(--c);
  background: color-mix(in srgb, var(--c) 14%, #ffffff);
  color: #102016;
}

.su-pay__fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(120px, 0.65fr) auto;
  gap: 8px;
  align-items: end;
}

.su-pay__field {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.su-pay__field span,
.su-pay__result span {
  color: #6b7a6f;
  font-size: 0.7rem;
  font-weight: 800;
}

.su-pay__result {
  display: grid;
  gap: 4px;
  min-width: 124px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #eef8ee;
}

.su-pay__result strong {
  color: #0a6f1f;
  font-size: 0.9rem;
  font-weight: 950;
}

.su-pay__note {
  margin: 0;
  color: #6b7a6f;
  font-size: 0.76rem;
  font-weight: 650;
}

.su-quick {
  padding: 10px 14px;
  border-bottom: 1px solid #eff4ef;
}

.su-quick div {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.su-quick button {
  min-height: 30px;
  padding: 0 9px;
}

.su-quick button:hover {
  border-color: #9bc99f;
  background: #f1f8ef;
}

.su-quick button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.su-quick button.is-danger {
  color: #b91c1c;
  border-color: #f4c7c7;
}

/* ---------- Formulario del modal ---------- */
.su-form {
  display: grid;
  gap: 10px;
}

.su-form__block {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e7eee8;
  border-radius: 12px;
  background: #ffffff;
}

.su-form__block--primary {
  border-color: #cfe8d1;
  background: #f8fcf7;
}

.su-form__block-head {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}

.su-form__block-head > span {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  background: #eaf6e7;
  color: #0a6f1f;
  font-size: 0.74rem;
  font-weight: 900;
}

.su-form__block-head strong {
  display: block;
  color: #0d2b5e;
  font-size: 0.84rem;
  font-weight: 950;
}

.su-form__block-head small {
  display: block;
  margin-top: 1px;
  color: #6b7a6f;
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1.3;
}

.su-form__access {
  display: grid;
  gap: 8px;
  padding-top: 2px;
}

.su-form__hint {
  margin: -4px 0 0;
  font-size: 0.76rem;
  font-weight: 600;
  color: #6b7a6f;
  line-height: 1.4;
}

.su-form__hint--ok {
  color: #0a6f1f;
  display: flex;
  align-items: center;
  gap: 6px;
}

.su-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.su-form__field {
  display: grid;
  gap: 5px;
}

.su-form__field label {
  font-size: 0.76rem;
  font-weight: 800;
  color: #41617f;
}

.su-dialog :deep(.p-dialog-content) {
  max-height: min(72vh, 620px);
  overflow-y: auto;
  padding-top: 0.4rem;
}

.su-dialog :deep(.p-dialog-footer) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 0.7rem;
}

.su-form__error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 8px 11px;
  border-radius: 8px;
  background: #fde8e8;
  color: #b91c1c;
  font-size: 0.78rem;
  font-weight: 700;
}

@media (max-width: 520px) {
  .su-form__row {
    grid-template-columns: 1fr;
  }

  .su-form__block {
    padding: 10px;
  }

  .su-dialog :deep(.p-dialog-header) {
    padding: 0.9rem 1rem 0.65rem;
  }

  .su-dialog :deep(.p-dialog-content) {
    padding-inline: 0.75rem;
  }

  .su-dialog :deep(.p-dialog-footer) {
    flex-direction: column-reverse;
    padding-inline: 0.75rem;
  }

  .su-dialog :deep(.p-dialog-footer .p-button) {
    width: 100%;
  }
}

.su-jss-wrap {
  overflow-x: auto;
  padding: 12px 14px;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
}

.su-schedule-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px 0;
}

.su-schedule-head > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #5d6b61;
  font-size: 0.72rem;
  font-weight: 800;
}

.su-schedule-head > div {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.su-jss-wrap:not(.is-editing) .su-jss {
  pointer-events: none;
  opacity: 0.78;
}

/* Ajustes finos sobre el tema base de jspreadsheet. */
.su-jss :deep(.jss_worksheet) {
  font-family: inherit;
  font-size: 0.68rem;
}

.su-jss :deep(.jss_container),
.su-jss :deep(.jss_content) {
  display: block;
  width: 100% !important;
  max-width: 100% !important;
}

/* La tabla llena el ancho de la tarjeta (HORA fija, días repartidos). */
.su-jss :deep(table) {
  width: 100% !important;
  table-layout: fixed;
}

.su-jss :deep(col) {
  width: auto !important;
}

.su-jss :deep(col:first-child) {
  width: 56px !important;
}

.su-jss :deep(thead td) {
  background: #f3faf2;
  color: #41617f;
  font-size: 0.64rem;
  font-weight: 800;
  text-align: center;
}

/* Celdas de día: clic/arrastre para pintar, sin texto editable a la vista. */
.su-jss :deep(tbody td) {
  cursor: pointer;
  height: 22px;
  user-select: none;
  -webkit-user-select: none;
}

.su-jss :deep(tbody td:not(:first-child)) {
  touch-action: none;
}

.su-jss :deep(tbody td.su-on) {
  color: transparent;
  border-color: rgba(0, 0, 0, 0.08);
}

.su-jss :deep(tbody td.su-preview-on) {
  background: color-mix(in srgb, var(--c) 72%, #ffffff) !important;
  outline: 2px solid color-mix(in srgb, var(--c) 76%, #0a6f1f);
  outline-offset: -2px;
}

.su-jss :deep(tbody td.su-preview-off) {
  background: repeating-linear-gradient(
    135deg,
    rgba(239, 68, 68, 0.1),
    rgba(239, 68, 68, 0.1) 5px,
    rgba(255, 255, 255, 0.82) 5px,
    rgba(255, 255, 255, 0.82) 10px
  ) !important;
  outline: 2px solid rgba(239, 68, 68, 0.45);
  outline-offset: -2px;
}

/* La primera columna (HORA) no se pinta ni cambia el cursor. */
.su-jss :deep(tbody td:first-child) {
  cursor: default;
  color: #8a978d;
  font-weight: 700;
  background: #fbfdfb;
}

.su-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid #eff4ef;
  font-size: 0.78rem;
  font-weight: 700;
  color: #5d6b61;
}

.su-card__metric {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.su-card__foot strong {
  padding: 4px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--c) 14%, #fff);
  font-size: 0.86rem;
  font-weight: 900;
}

.su-card__foot strong.su-card__cost {
  background: #eaf6e7;
  color: #0a6f1f;
}

.su-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 0;
  padding: 11px 14px;
  border-radius: 12px;
  background: #f1f6fb;
  color: #41617f;
  font-size: 0.8rem;
  font-weight: 600;
}

.su-hint i,
.su-note i {
  color: #3b82f6;
}

/* Nota informativa al pie (autosave + resumen en vivo). */
.su-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: #f7fbf6;
  border: 1px solid #e7eee8;
  font-size: 0.78rem;
  font-weight: 600;
  color: #5d6b61;
}

/* Aviso flotante de guardado (reemplaza el chip del antiguo footer). */
.su-toast {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1200;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 16px;
  border-radius: 12px;
  background: #0a6f1f;
  color: #fff;
  font-size: 0.84rem;
  font-weight: 800;
  box-shadow: 0 12px 28px rgba(10, 111, 31, 0.28);
}

.su-toast-enter-active,
.su-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.su-toast-enter-from,
.su-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* ---------- Resumen ---------- */
.su-summary {
  border: 1px solid #e7eee8;
  border-radius: 16px;
  background: #fff;
  padding: 18px 20px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.su-summary__body {
  margin-top: 14px;
}

.su-table-wrap {
  overflow-x: auto;
}

.su-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.su-table th {
  text-align: left;
  padding: 0 12px 10px;
  font-size: 0.7rem;
  font-weight: 800;
  color: #8a978d;
  vertical-align: bottom;
}

.su-table th small {
  display: block;
  font-weight: 600;
  font-size: 0.62rem;
}

.su-table th.num,
.su-table td.num {
  text-align: right;
}

.su-table td {
  padding: 11px 12px;
  border-top: 1px solid #eff4ef;
  font-weight: 700;
}

.su-table td.strong {
  font-weight: 900;
}

.su-tag-propio {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #eef2fb;
  color: #2f5fd0;
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.su-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 8px;
  border-radius: 50%;
  vertical-align: middle;
}

.su-table tfoot td {
  border-top: 2px solid #e3e9e3;
  font-weight: 900;
  font-size: 0.9rem;
}

.su-table tfoot .total {
  color: #0a6f1f;
  font-size: 1.05rem;
}

/* ---------- Loading ---------- */
.su-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 40px;
  justify-content: center;
  color: #6b7a6f;
  font-weight: 700;
}

.su-spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 3px solid #d9ead9;
  border-top-color: #0b6f38;
  animation: su-spin 0.8s linear infinite;
}

@keyframes su-spin {
  to { transform: rotate(360deg); }
}

/* ---------- Responsive ---------- */
@media (max-width: 900px) {
  .su-grid,
  .su-overview {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .sueldos {
    gap: 18px;
  }

  /* Encabezado de sección: el botón "Agregar empleado" baja y se estira. */
  .su-section-head {
    flex-direction: column;
    align-items: stretch;
  }

  .su-pay__head,
  .su-quick {
    align-items: stretch;
    flex-direction: column;
  }

  .su-pay__modes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .su-pay__fields {
    grid-template-columns: 1fr;
  }

  .su-quick div {
    justify-content: stretch;
  }

  .su-quick button {
    flex: 1 1 45%;
  }

  .su-schedule-head {
    align-items: stretch;
    flex-direction: column;
  }

  .su-schedule-head > div {
    justify-content: stretch;
  }

  .su-schedule-head :deep(.p-button) {
    flex: 1;
  }

  .su-jss-wrap {
    padding: 10px 6px;
  }

  .su-jss :deep(col:first-child) {
    width: 42px !important;
  }

  .su-jss :deep(thead td),
  .su-jss :deep(tbody td) {
    padding-inline: 2px;
    font-size: 0.6rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .su-spinner { animation: none; }
}
</style>
