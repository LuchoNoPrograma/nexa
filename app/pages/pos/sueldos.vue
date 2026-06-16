<script setup lang="ts">
import 'jspreadsheet-ce/dist/jspreadsheet.css'
import 'jsuites/dist/jsuites.css'
import {
  DIAS_SEMANA,
  HORAS_DIA,
  COLORES_EMPLEADO,
  HORAS_MENSUALES_REFERENCIA,
  SEMANAS_POR_MES,
  JORNADA_SEMANAL_LEGAL,
  slotKey,
  calcularSueldo,
  valorHora,
  type NominaConfig,
} from '~~/shared/utils/nomina'

definePageMeta({
  layout: 'pos',
  posTitle: 'Planilla',
})

useHead({ title: 'Planilla | NEXA' })

type Rol = 'cajero' | 'administrador'

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
function fmtHora(hora: number) {
  return `${String(hora).padStart(2, '0')}:00`
}

function aEmpleado(row: any): Empleado {
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
    slots,
  }
}

// ---------- jspreadsheet (hoja de cálculo por trabajador) ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let jss: any = null
const instancias = new Map<string, any>()
const gridEls = new Map<string, HTMLElement>()

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

// Al soltar una selección dentro de la hoja, pinta o borra el rango (el modo lo
// decide la celda de inicio): así "arrastrar" sobre la hoja marca las horas.
function aplicarSeleccion(emp: Empleado) {
  const ws = instancias.get(emp.id)
  if (!ws) {
    return
  }
  const sel = ws.getSelection?.()
  if (!sel || sel.length < 4) {
    return
  }
  const x1 = Math.max(1, Math.min(sel[0], sel[2]))
  const x2 = Math.min(DIAS_SEMANA.length, Math.max(sel[0], sel[2]))
  const y1 = Math.max(0, Math.min(sel[1], sel[3]))
  const y2 = Math.min(HORAS_DIA.length - 1, Math.max(sel[1], sel[3]))
  if (x1 > DIAS_SEMANA.length || x2 < 1 || y1 > HORAS_DIA.length - 1 || y2 < 0) {
    return
  }

  const anchorKey = slotKey(DIAS_SEMANA[x1 - 1].idx, HORAS_DIA[y1])
  const borrar = emp.slots.has(anchorKey)

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

  ws.resetSelection?.()
  repintar(emp)
  void guardarHorario(emp)
}

function onDocPointerUp(e: PointerEvent) {
  if (!jss) {
    return
  }
  const target = e.target as Node
  for (const [empId, el] of gridEls) {
    if (el.contains(target)) {
      const emp = empleados.value.find(x => x.id === empId)
      if (emp) {
        // Espera a que jspreadsheet finalice su propia selección del mouseup.
        setTimeout(() => aplicarSeleccion(emp), 0)
      }
      return
    }
  }
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

    // Demo: si la tienda aún no tiene personal, arranca con un trabajador base.
    if (!empleados.value.length) {
      await agregarEmpleado(false)
    }
  } catch {
    // Sin datos: se queda con la config por defecto.
  } finally {
    cargando.value = false
  }

  await construirTodos()
  document.addEventListener('pointerup', onDocPointerUp)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerup', onDocPointerUp)
  for (const id of [...instancias.keys()]) {
    destruirGrid(id)
  }
  for (const timer of nombreTimers.values()) {
    clearTimeout(timer)
  }
  nombreTimers.clear()
  if (configTimer) {
    clearTimeout(configTimer)
  }
})

// ---------- Cálculos derivados ----------
const valorHoraActual = computed(() => valorHora(config))

const filas = computed(() =>
  empleados.value.map((emp) => {
    const calc = calcularSueldo(emp.slots.size, config)
    return {
      id: emp.id,
      etiqueta: `Empleado ${emp.numero}`,
      nombre: emp.nombre,
      color: emp.color,
      horasSemanales: calc.horasSemanales,
      horasMensuales: calc.horasMensuales,
      sueldoMensual: calc.sueldoMensual,
    }
  }),
)

const totalSueldos = computed(() => filas.value.reduce((s, f) => s + f.sueldoMensual, 0))

// ---------- Persistencia ----------
async function guardarHorario(emp: Empleado) {
  const slots = [...emp.slots].map((key) => {
    const [dia, hora] = key.split('-').map(Number)
    return { dia, hora }
  })
  await $fetch(`/api/pos/nomina/empleados/${emp.id}/horario`, { method: 'PUT', body: { slots } }).catch(() => null)
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

let configTimer: ReturnType<typeof setTimeout> | undefined
function onConfig() {
  clearTimeout(configTimer)
  configTimer = setTimeout(() => {
    void $fetch('/api/pos/nomina/config', { method: 'PUT', body: { salarioMinimoMensual: config.salarioMinimoMensual } }).catch(() => null)
  }, 500)
}

async function agregarEmpleado(notify = true) {
  try {
    const data = await $fetch<{ empleado: any }>('/api/pos/nomina/empleados', { method: 'POST', body: {} })
    const emp = aEmpleado(data.empleado)
    empleados.value.push(emp)
    if (jss) {
      await nextTick()
      construirGrid(emp)
    }
    if (notify) {
      flash('Empleado agregado')
    }
  } catch {
    if (notify) {
      flash('No se pudo agregar el empleado')
    }
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
  await $fetch(`/api/pos/nomina/empleados/${emp.id}`, { method: 'DELETE' }).catch(() => null)
  empleados.value = empleados.value.filter(e => e.id !== emp.id)
}

async function limpiarEmpleado(emp: Empleado) {
  emp.slots.clear()
  repintar(emp)
  await guardarHorario(emp)
  flash('Horas limpiadas')
}

// ---------- Modal: editar info de contacto + acceso (rol) ----------
const editVisible = ref(false)
const editEmp = ref<Empleado | null>(null)
const guardandoInfo = ref(false)
const infoError = ref('')

const ROLES_OPCIONES = [
  { label: 'Sin acceso', value: '' },
  { label: 'Cajero (Caja y Vender)', value: 'cajero' },
  { label: 'Administrador (acceso completo)', value: 'administrador' },
]

const editForm = reactive({
  nombre: '',
  puesto: '',
  celular: '',
  fechaNacimiento: '',
  direccion: '',
  rol: '' as '' | Rol,
  ci: '',
  password: '',
})

// ¿El rol elegido necesita credenciales nuevas? (empleado sin login aún)
const requiereCredenciales = computed(() => Boolean(editForm.rol) && !editEmp.value?.tieneLogin)

function abrirEditar(emp: Empleado) {
  editEmp.value = emp
  infoError.value = ''
  editForm.nombre = emp.nombre
  editForm.puesto = emp.puesto ?? ''
  editForm.celular = emp.celular ?? ''
  editForm.fechaNacimiento = emp.fechaNacimiento ?? ''
  editForm.direccion = emp.direccion ?? ''
  editForm.rol = emp.rol ?? ''
  editForm.ci = emp.ci ?? ''
  editForm.password = ''
  editVisible.value = true
}

async function guardarInfo() {
  const emp = editEmp.value
  if (!emp) {
    return
  }

  infoError.value = ''

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
    // 1) Datos de contacto.
    const { empleado: actualizado } = await $fetch<{ empleado: any }>(`/api/pos/nomina/empleados/${emp.id}`, {
      method: 'PUT',
      body: {
        nombre: editForm.nombre.trim(),
        puesto: editForm.puesto.trim(),
        celular: editForm.celular.trim(),
        fechaNacimiento: editForm.fechaNacimiento.trim(),
        direccion: editForm.direccion.trim(),
      },
    })

    emp.nombre = actualizado.nombre ?? emp.nombre
    emp.puesto = actualizado.puesto ?? null
    emp.celular = actualizado.celular ?? null
    emp.fechaNacimiento = actualizado.fechaNacimiento ?? null
    emp.direccion = actualizado.direccion ?? null

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
          <strong>Planilla</strong>
        </nav>
        <h1>Planilla de turnos y costo laboral</h1>
        <p>Planifica horarios de trabajo y estima el costo mensual del personal para entender mejor la rentabilidad del negocio.</p>
      </div>

      <div class="su-min">
        <div class="su-min__title">
          <i class="pi pi-flag" />
          <div>
          <strong>Base salarial editable</strong>
          <small>Referencia mensual para estimación</small>
          </div>
        </div>
        <InputNumber
          v-model="config.salarioMinimoMensual"
          mode="currency"
          currency="BOB"
          locale="es-BO"
          :min="0"
          fluid
          @update:model-value="onConfig"
        />
        <small class="su-min__hint">Este valor es configurable y se usa solo para estimaciones internas.</small>
      </div>
    </header>

    <div v-if="cargando" class="su-loading">
      <span class="su-spinner" aria-hidden="true" /> Cargando…
    </div>

    <template v-else>
      <!-- 1. Hojas de cálculo por trabajador -->
      <section>
        <div class="su-section-head">
        <h2>1. Define turnos semanales</h2>
          <button type="button" class="su-add" @click="agregarEmpleado()">
            <i class="pi pi-plus" /> Agregar empleado
          </button>
        </div>
        <p class="su-section-sub">Haz clic y arrastra sobre la hoja para marcar las horas planificadas de cada persona.</p>

        <div class="su-grid">
          <article
            v-for="(emp, i) in empleados"
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
              <button type="button" class="su-card__clear" title="Limpiar horas" @click="limpiarEmpleado(emp)">
                <i class="pi pi-eraser" />
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

            <div class="su-jss-wrap">
              <div :ref="el => setGridEl(emp.id, el)" class="su-jss" />
            </div>

            <footer class="su-card__foot">
              <span>Total horas semanales:</span>
              <strong :style="{ color: emp.color }">{{ emp.slots.size }} h</strong>
            </footer>
          </article>

          <!-- Tarjeta para agregar un nuevo trabajador (estilo Google) -->
          <button type="button" class="su-card su-card--add" @click="agregarEmpleado()">
            <span class="su-card-add__icon"><i class="pi pi-plus" /></span>
            <strong>Agregar empleado</strong>
            <small>Crea una nueva planilla de turnos</small>
          </button>
        </div>

        <p class="su-hint"><i class="pi pi-info-circle" /> Selecciona una celda o arrastra un rango sobre la hoja para marcar o borrar horas planificadas.</p>
      </section>

      <!-- 2. Resumen -->
      <section id="resumen" class="su-summary">
        <h2>2. Cómo se estima el costo laboral</h2>
        <p class="su-section-sub">El costo se calcula con las horas planificadas y la base salarial configurable.</p>

        <div class="su-summary__body">
          <aside class="su-ref">
            <strong>Datos de referencia</strong>
            <div class="su-ref__row">
              <span>Base mensual</span>
              <b>{{ money(config.salarioMinimoMensual) }}</b>
            </div>
            <div class="su-ref__row">
              <span>Horas mensuales de referencia</span>
              <b>{{ config.horasMensualesReferencia }} h</b>
            </div>
            <small>({{ JORNADA_SEMANAL_LEGAL }} h/semana × {{ config.semanasPorMes }} semanas — jornada completa)</small>
            <div class="su-ref__row su-ref__row--hl">
              <span>Valor hora</span>
              <b>{{ money(valorHoraActual) }}</b>
            </div>
            <small>({{ fmt.format(config.salarioMinimoMensual) }} ÷ {{ config.horasMensualesReferencia }})</small>
          </aside>

          <div class="su-table-wrap">
            <table class="su-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th class="num">Total horas semanales</th>
                  <th class="num">Total horas mensuales<small>(aprox. {{ config.semanasPorMes }} semanas)</small></th>
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
                  <td class="num strong">{{ money(f.sueldoMensual) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3">Costo laboral mensual estimado</td>
                  <td class="num strong total">{{ money(totalSueldos) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      <!-- Nota: los cambios se guardan automáticamente; el resumen es en vivo. -->
      <p class="su-note">
        <i class="pi pi-lightbulb" /> Los cambios se guardan solos y el resumen se actualiza al instante.
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
      :header="editEmp ? `Empleado ${editEmp.numero}` : 'Empleado'"
      class="su-dialog"
      :style="{ width: '480px' }"
    >
      <div class="su-form">
        <p class="su-form__section">Datos de contacto</p>

        <div class="su-form__field">
          <label>Nombre</label>
          <InputText v-model="editForm.nombre" placeholder="Nombre completo" fluid />
        </div>

        <div class="su-form__row">
          <div class="su-form__field">
            <label>Celular</label>
            <InputText v-model="editForm.celular" placeholder="Ej. 70012345" fluid />
          </div>
          <div class="su-form__field">
            <label>Fecha de nacimiento</label>
            <input v-model="editForm.fechaNacimiento" type="date" class="su-date">
          </div>
        </div>

        <div class="su-form__field">
          <label>Dirección</label>
          <InputText v-model="editForm.direccion" placeholder="Calle, zona, referencia" fluid />
        </div>

        <div class="su-form__field">
          <label>Puesto</label>
          <InputText v-model="editForm.puesto" placeholder="Ej. Atención y caja" fluid />
        </div>

        <p class="su-form__section">Acceso al sistema</p>
        <p class="su-form__hint">
          Asigna un rol para que el empleado inicie sesión con su <strong>CI</strong> y una contraseña.
          Un cajero solo accede a <strong>Caja</strong> y <strong>Vender</strong>.
        </p>

        <div class="su-form__field">
          <label>Rol</label>
          <Select v-model="editForm.rol" :options="ROLES_OPCIONES" option-label="label" option-value="value" fluid />
        </div>

        <template v-if="editForm.rol">
          <div class="su-form__row">
            <div class="su-form__field">
              <label>CI (carnet de identidad)</label>
              <InputText v-model="editForm.ci" placeholder="Ej. 1234567" fluid />
            </div>
            <div class="su-form__field">
              <label>{{ editEmp?.tieneLogin ? 'Nueva contraseña' : 'Contraseña' }}</label>
              <InputText
                v-model="editForm.password"
                type="password"
                :placeholder="editEmp?.tieneLogin ? 'Dejar vacío para no cambiar' : 'Mínimo 4 caracteres'"
                fluid
              />
            </div>
          </div>
          <p v-if="editEmp?.tieneLogin" class="su-form__hint su-form__hint--ok">
            <i class="pi pi-check-circle" /> Este empleado ya tiene acceso. Solo cambia lo necesario.
          </p>
        </template>

        <p v-if="infoError" class="su-form__error"><i class="pi pi-exclamation-triangle" /> {{ infoError }}</p>
      </div>

      <template #footer>
        <Button type="button" label="Cancelar" outlined severity="secondary" @click="editVisible = false" />
        <Button type="button" label="Guardar" :loading="guardandoInfo" @click="guardarInfo" />
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 460px);
  gap: 18px;
  align-items: start;
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

.su-min {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid #e7eee8;
  border-radius: 14px;
  background: #f7fbf6;
}

.su-min__title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.su-min__title i {
  color: #0a6f1f;
  font-size: 1.2rem;
}

.su-min__title strong {
  display: block;
  font-size: 0.86rem;
  font-weight: 900;
}

.su-min__title small,
.su-min__hint {
  font-size: 0.72rem;
  font-weight: 600;
  color: #6b7a6f;
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

.su-add {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  border: 1px solid #cfe3c6;
  border-radius: 10px;
  background: #eaf6e7;
  color: #1c7a2c;
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

.su-add:hover {
  background: #def0d8;
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
.su-card__clear,
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

.su-card__clear {
  background: #eaf6e7;
  color: #1c7a2c;
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
  padding: 0 14px 4px;
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

/* ---------- Formulario del modal ---------- */
.su-form {
  display: grid;
  gap: 12px;
}

.su-form__section {
  margin: 6px 0 0;
  font-size: 0.78rem;
  font-weight: 900;
  color: #0d2b5e;
  text-transform: uppercase;
  letter-spacing: 0.02em;
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
  gap: 12px;
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

.su-date {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: inherit;
  color: #102016;
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
}

.su-jss-wrap {
  overflow-x: auto;
  padding: 12px 14px;
}

/* Ajustes finos sobre el tema base de jspreadsheet. */
.su-jss :deep(.jss_worksheet) {
  font-family: inherit;
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
  font-weight: 800;
  text-align: center;
}

/* Celdas de día: clic/arrastre para pintar, sin texto editable a la vista. */
.su-jss :deep(tbody td) {
  cursor: pointer;
  height: 22px;
}

.su-jss :deep(tbody td.su-on) {
  color: transparent;
  border-color: rgba(0, 0, 0, 0.08);
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
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid #eff4ef;
  font-size: 0.78rem;
  font-weight: 700;
  color: #5d6b61;
}

.su-card__foot strong {
  padding: 4px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--c) 14%, #fff);
  font-size: 0.86rem;
  font-weight: 900;
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
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 18px;
  margin-top: 14px;
}

.su-ref {
  display: grid;
  gap: 6px;
  align-content: start;
  padding: 16px;
  border-radius: 14px;
  background: #f7fbf6;
  border: 1px solid #e7eee8;
}

.su-ref > strong {
  font-size: 0.86rem;
  font-weight: 900;
  margin-bottom: 4px;
}

.su-ref__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #4a5a4f;
}

.su-ref__row b {
  font-weight: 900;
  color: #102016;
}

.su-ref__row--hl b {
  color: #0a6f1f;
  font-size: 1rem;
}

.su-ref small {
  font-size: 0.68rem;
  color: #8a978d;
  font-weight: 600;
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
  /* La tarjeta de base salarial pasa a ancho completo, debajo del título. */
  .su-header,
  .su-grid,
  .su-summary__body {
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

  .su-add {
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .su-spinner { animation: none; }
}
</style>
