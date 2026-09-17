import { useEffect, useMemo, useRef, useState } from 'react'

const ACTIVIDADES = [
  { clave: 'masajes', nombre: 'Masajes', color: 'var(--serie-1)' },
  { clave: 'recuperacion', nombre: 'Recuperación física', color: 'var(--serie-2)' },
]

const FAVORITAS = ['Todas', 'Masajes', 'Recuperación física', 'Empate', 'Ninguna']

// Columnas de la tabla de colaboradores: todas se pueden ordenar
const COLUMNAS = [
  { campo: 'id_usuario', titulo: 'ID' },
  { campo: 'nombre_completo', titulo: 'Nombre' },
  { campo: 'area', titulo: 'Área' },
  { campo: 'veces_masajes', titulo: 'Masajes', numero: true },
  { campo: 'veces_recuperacion', titulo: 'Recuperación', numero: true },
  { campo: 'total_visitas', titulo: 'Total', numero: true },
  { campo: 'actividad_favorita', titulo: 'Fue más a' },
]

const numero = (n) => Number(n).toLocaleString('es-MX')
const pct = (n) => `${Number(n).toFixed(1)}%`
const promedio = (n) => Number(n).toFixed(2)

async function api(url) {
  const r = await fetch(url)
  const datos = await r.json()
  if (!r.ok) throw new Error(datos.error)
  return datos
}

// Escala con marcas redondas (0, 10, 20...) para el eje
function escala(maximo) {
  const paso = maximo <= 10 ? 2 : maximo <= 50 ? 10 : maximo <= 100 ? 20 : maximo <= 250 ? 50 : 100
  const tope = Math.max(paso, Math.ceil(maximo / paso) * paso)
  const marcas = []
  for (let m = 0; m <= tope; m += paso) marcas.push(m)
  return { tope, marcas }
}

// Tooltip que sigue al mouse (o al foco con teclado)
function useTooltip() {
  const [tip, setTip] = useState(null)
  const props = (texto) => ({
    tabIndex: 0,
    'aria-label': texto.replace(/\n/g, ', '),
    onMouseMove: (e) => setTip({ x: e.clientX, y: e.clientY, texto }),
    onMouseLeave: () => setTip(null),
    onFocus: (e) => {
      const r = e.currentTarget.getBoundingClientRect()
      setTip({ x: r.left + r.width / 2, y: r.top, texto })
    },
    onBlur: () => setTip(null),
  })
  const elemento = tip && (
    <div className="tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.texto}
    </div>
  )
  return [props, elemento]
}

// Las graficas se pintan en cero y crecen en el primer cuadro: de ahi la animacion
function useMontado() {
  const [listo, setListo] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setListo(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return listo
}

// Tema manual; si nunca se ha elegido, manda el del sistema
function useTema() {
  const [tema, setTema] = useState(() => {
    try {
      const guardado = localStorage.getItem('tema')
      if (guardado) return guardado
    } catch {
      // Modo privado o cookies bloqueadas: se sigue con el del sistema
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema)
    try {
      localStorage.setItem('tema', tema)
    } catch {
      // Si no se puede guardar, el tema igual funciona en esta sesion
    }
  }, [tema])

  return [tema, () => setTema((t) => (t === 'dark' ? 'light' : 'dark'))]
}

function Leyenda() {
  return (
    <ul className="leyenda">
      {ACTIVIDADES.map((a) => (
        <li key={a.clave}>
          <span className="muestra" style={{ background: a.color }} />
          {a.nombre}
        </li>
      ))}
    </ul>
  )
}

function Indicador({ etiqueta, valor, detalle }) {
  return (
    <div className="tarjeta indicador">
      <span className="indicador-etiqueta">{etiqueta}</span>
      <span className="indicador-valor">{valor}</span>
      {detalle && <span className="nota">{detalle}</span>}
    </div>
  )
}

// Barra horizontal con el valor en la punta
function Barra({ nombre, valor, tope, color, texto, tooltip }) {
  return (
    <div className="barra-fila" {...tooltip(`${nombre}\n${texto}`)}>
      <span className="barra-nombre">{nombre}</span>
      <div className="barra-pista">
        <div className="barra-relleno" style={{ width: `${(valor / tope) * 100}%`, background: color }} />
      </div>
      <span className="barra-valor">{texto}</span>
    </div>
  )
}

// Cuantas veces fue cada area a cada actividad
function AreaActividad({ datos, tooltip }) {
  const listo = useMontado()
  const total = (d) => d.visitas_masajes + d.visitas_recuperacion
  const filas = [...datos].sort((a, b) => total(b) - total(a))
  const tope = Math.max(...filas.map(total))

  return (
    <section className="tarjeta">
      <div className="barra-titulo">
        <h2 className="subtitulo">Visitas por área y actividad</h2>
        <Leyenda />
      </div>
      <p className="nota">
        Cuántas veces fue cada área a cada sección, y qué parte del área asistió al menos una vez.
      </p>
      <div className="areas">
        <div className="fila-area cabecera-area">
          <span>Área</span>
          <span>Visitas por actividad</span>
          <span className="numero">Total</span>
          <span>Asistencia del área</span>
          <span className="numero">%</span>
        </div>
        {filas.map((d) => (
          <div
            className="fila-area"
            key={d.area}
            {...tooltip(
              `${d.area}\n` +
                ACTIVIDADES.map((a) => `${a.nombre}: ${numero(d[`visitas_${a.clave}`])}`).join('\n') +
                `\nTotal: ${numero(total(d))}\nAsistió: ${pct(d.pct_asistencia)} de ${d.usuarios} personas`
            )}
          >
            <span className="barra-nombre">{d.area}</span>
            <div className="barra-pista">
              <div className="apilada-barra" style={{ width: listo ? `${(total(d) / tope) * 100}%` : 0 }}>
                {ACTIVIDADES.map((a) => (
                  <div
                    key={a.clave}
                    className="segmento-apilado"
                    style={{ flexGrow: d[`visitas_${a.clave}`], background: a.color }}
                  />
                ))}
              </div>
            </div>
            <span className="barra-valor">{numero(total(d))}</span>
            {/* Gris a proposito: es otra medida, no una de las dos actividades */}
            <div className="barra-pista">
              <div className="barra-relleno relleno-asistencia" style={{ width: listo ? `${d.pct_asistencia}%` : 0 }} />
            </div>
            <span className="barra-valor">{pct(d.pct_asistencia)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// Dona: el reparto de las visitas entre las dos actividades
const RADIO = 60
const VUELTA = 2 * Math.PI * RADIO

function RepartoVisitas({ resumen, tooltip }) {
  const listo = useMontado()
  let recorrido = 0

  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Reparto de visitas</h2>
      <p className="nota">{numero(resumen.total_visitas)} visitas en total.</p>
      <div className="dona">
        <svg viewBox="0 0 160 160" aria-hidden="true">
          {ACTIVIDADES.map((a) => {
            const parte = Number(resumen[`pct_visitas_${a.clave}`]) / 100
            // Se le quitan 2px al arco para que quede aire entre las dos rebanadas
            const largo = Math.max(VUELTA * parte - 2, 0)
            const inicio = recorrido
            recorrido += VUELTA * parte
            return (
              <circle
                key={a.clave}
                className="rebanada"
                cx="80"
                cy="80"
                r={RADIO}
                fill="none"
                stroke={a.color}
                strokeWidth="24"
                strokeDasharray={`${listo ? largo : 0} ${VUELTA}`}
                strokeDashoffset={-inicio}
                {...tooltip(
                  `${a.nombre}\n${numero(resumen[`visitas_${a.clave}`])} visitas · ${pct(
                    resumen[`pct_visitas_${a.clave}`]
                  )}`
                )}
              />
            )
          })}
        </svg>
        <div className="dona-centro">
          <span className="dona-total">{numero(resumen.total_visitas)}</span>
          <span className="nota">visitas</span>
        </div>
      </div>
      <ul className="leyenda leyenda-valores">
        {ACTIVIDADES.map((a) => (
          <li key={a.clave}>
            <span className="muestra" style={{ background: a.color }} />
            {a.nombre}
            <strong>{pct(resumen[`pct_visitas_${a.clave}`])}</strong>
            <span className="nota">{numero(resumen[`visitas_${a.clave}`])} visitas</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PorDia({ datos, tooltip }) {
  const { tope } = escala(Math.max(...datos.flatMap((d) => [d.masajes, d.recuperacion])))
  return (
    <section className="tarjeta">
      <div className="barra-titulo">
        <h2 className="subtitulo">Visitas por día</h2>
        <Leyenda />
      </div>
      {datos.map((d) => (
        <div className="grupo-dia" key={d.dia}>
          <span className="grupo-dia-nombre">{d.dia}</span>
          {ACTIVIDADES.map((a) => (
            <Barra
              key={a.clave}
              nombre={a.nombre}
              valor={d[a.clave]}
              tope={tope}
              color={a.color}
              texto={numero(d[a.clave])}
              tooltip={tooltip}
            />
          ))}
        </div>
      ))}
    </section>
  )
}

// Linea por actividad: la hora es un eje continuo, asi se ve la curva del dia
function PorHora({ datos, tooltip }) {
  const { tope, marcas } = escala(Math.max(...datos.flatMap((d) => [d.masajes, d.recuperacion])))
  const ancho = 100 / datos.length
  // Cada punto va al centro de su banda, asi la cruz del hover cae sobre el dato
  const x = (i) => (i + 0.5) * ancho
  const alto = (v) => (v / tope) * 100
  const pico = (clave) => datos.reduce((a, b) => (b[clave] > a[clave] ? b : a))

  return (
    <section className="tarjeta">
      <div className="barra-titulo">
        <h2 className="subtitulo">Visitas por hora</h2>
        <Leyenda />
      </div>
      <div className="tabla">
        <div className="lienzo">
          {marcas.map((m) => (
            <div key={m} className="rejilla" style={{ bottom: `${(m / tope) * 100}%` }}>
              <span>{m}</span>
            </div>
          ))}

          <svg className="lineas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {ACTIVIDADES.map((a) => (
              <polyline
                key={a.clave}
                points={datos.map((d, i) => `${x(i)},${100 - alto(d[a.clave])}`).join(' ')}
                fill="none"
                stroke={a.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {ACTIVIDADES.flatMap((a) =>
            datos.map((d, i) => (
              <span
                key={`${a.clave}-${d.hora_del_dia}`}
                className="punto"
                style={{ left: `${x(i)}%`, bottom: `${alto(d[a.clave])}%`, background: a.color }}
              />
            ))
          )}

          {/* Solo se etiqueta el pico de cada actividad; el resto lo cuenta el eje */}
          {ACTIVIDADES.map((a) => {
            const p = pico(a.clave)
            return (
              <span
                key={`pico-${a.clave}`}
                className="punto-valor"
                style={{ left: `${x(datos.indexOf(p))}%`, bottom: `${alto(p[a.clave])}%` }}
              >
                {numero(p[a.clave])}
              </span>
            )
          })}

          {datos.map((d, i) => (
            <div
              key={d.hora_del_dia}
              className="banda"
              style={{ left: `${i * ancho}%`, width: `${ancho}%` }}
              {...tooltip(
                `${d.hora_del_dia}:00 a ${d.hora_del_dia}:59\n` +
                  ACTIVIDADES.map((a) => `${a.nombre}: ${numero(d[a.clave])}`).join('\n')
              )}
            >
              <span className="etiqueta-x">{d.hora_del_dia}:00</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Histograma: cuantas visitas hubo en cada semana del periodo.
// Es la unica grafica que sigue el paso del tiempo; las demas agregan todo el semestre.
function Histograma({ datos, tooltip }) {
  const listo = useMontado()
  const { tope, marcas } = escala(Math.max(...datos.map((s) => s.total)))
  const cima = datos.reduce((a, b) => (b.total > a.total ? b : a))
  const promedioSemanal = datos.reduce((s, d) => s + d.total, 0) / datos.length

  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Visitas por semana</h2>
      <p className="nota">
        Las {numero(datos.length)} semanas del periodo. La más alta fue la del {cima.inicio} con{' '}
        {numero(cima.total)} visitas; el promedio es {promedioSemanal.toFixed(1)} por semana.
      </p>
      <div className="tabla">
        <div className="histograma">
          {marcas.map((m) => (
            <div key={m} className="rejilla" style={{ bottom: `${(m / tope) * 100}%` }}>
              <span>{m}</span>
            </div>
          ))}
          {datos.map((s) => (
            <div
              key={s.semana}
              className="caja"
              {...tooltip(
                `Semana del ${s.inicio}\n${numero(s.total)} visitas\n` +
                  `Masajes: ${numero(s.masajes)}\nRecuperación física: ${numero(s.recuperacion)}`
              )}
            >
              {s === cima && (
                <span className="caja-valor" style={{ bottom: listo ? `${(s.total / tope) * 100}%` : 0 }}>
                  {numero(s.total)}
                </span>
              )}
              <div className="columna-h" style={{ height: listo ? `${(s.total / tope) * 100}%` : 0 }} />
              <span className="etiqueta-x">{s.inicio}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Usuarios({ datos }) {
  const [busqueda, setBusqueda] = useState('')
  const [favorita, setFavorita] = useState('Todas')
  const [orden, setOrden] = useState({ campo: 'total_visitas', dir: 'desc' })

  // Primer clic en una columna: de mayor a menor; el siguiente invierte
  const ordenarPor = (campo) =>
    setOrden((o) => ({ campo, dir: o.campo === campo && o.dir === 'desc' ? 'asc' : 'desc' }))

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    const lista = datos.filter(
      (u) =>
        (favorita === 'Todas' || u.actividad_favorita === favorita) &&
        (texto === '' || `${u.nombre_completo} ${u.area}`.toLowerCase().includes(texto))
    )
    // Los numeros se restan; los textos se comparan con el alfabeto en espanol
    return lista.sort((x, y) => {
      const a = x[orden.campo]
      const b = y[orden.campo]
      const signo = typeof a === 'number' ? a - b : String(a).localeCompare(String(b), 'es')
      return orden.dir === 'desc' ? -signo : signo
    })
  }, [datos, busqueda, favorita, orden])

  const colorFavorita = (f) => ACTIVIDADES.find((a) => a.nombre === f)?.color

  return (
    <section className="tarjeta">
      <div className="barra-titulo">
        <div>
          <h2 className="subtitulo">Colaboradores</h2>
          <p className="nota">
            Mostrando {filtrados.length} de {datos.length}
          </p>
        </div>
        <div className="filtros">
          <input
            className="control"
            type="search"
            placeholder="Buscar nombre o área"
            aria-label="Buscar nombre o área"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <select
            className="control"
            aria-label="Actividad favorita"
            value={favorita}
            onChange={(e) => setFavorita(e.target.value)}
          >
            {FAVORITAS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="tabla tabla-alta">
        <table>
          <thead>
            <tr>
              {COLUMNAS.map((c) => (
                <th
                  key={c.campo}
                  className={c.numero ? 'numero' : undefined}
                  aria-sort={
                    orden.campo === c.campo ? (orden.dir === 'desc' ? 'descending' : 'ascending') : 'none'
                  }
                >
                  <button type="button" className="orden" onClick={() => ordenarPor(c.campo)}>
                    {c.titulo}
                    {orden.campo === c.campo && (
                      <span className="orden-flecha" aria-hidden="true">
                        {orden.dir === 'desc' ? '▼' : '▲'}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((u) => (
              <tr key={u.id_usuario}>
                <td className="id">{u.id_usuario}</td>
                <td>{u.nombre_completo}</td>
                <td className="nota">{u.area}</td>
                <td className="numero">{u.veces_masajes}</td>
                <td className="numero">{u.veces_recuperacion}</td>
                <td className="numero">
                  <strong>{u.total_visitas}</strong>
                </td>
                <td>
                  {colorFavorita(u.actividad_favorita) && (
                    <span className="muestra" style={{ background: colorFavorita(u.actividad_favorita) }} />
                  )}
                  {u.actividad_favorita}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// 'dd/mm': del 29 de marzo al 8 de abril de 2026 cae la Semana Santa
const enSemanaSanta = (inicio) => {
  const [dia, mes] = inicio.split('/').map(Number)
  return (mes === 3 && dia >= 29) || (mes === 4 && dia <= 8)
}

// Boton + ventana que cuenta con palabras lo que las graficas muestran con formas
function Tendencias({ datos }) {
  const dialogo = useRef(null)

  const t = useMemo(() => {
    const { porHora, porSemana, tendencias } = datos
    const suma = (lista, clave) => lista.reduce((s, x) => s + Number(x[clave]), 0)
    const mayor = (lista, clave) => lista.reduce((a, b) => (Number(b[clave]) > Number(a[clave]) ? b : a))
    const menor = (lista, clave) => lista.reduce((a, b) => (Number(b[clave]) < Number(a[clave]) ? b : a))

    // Las semanas de un solo dia (la primera y la ultima) no se comparan con las completas
    const completas = porSemana.filter((s) => s.dias > 1)

    return {
      picoMasajes: mayor(porHora, 'masajes'),
      picoRecuperacion: mayor(porHora, 'recuperacion'),
      pctManana: Math.round(
        (suma(porHora.filter((h) => h.hora_del_dia < 12), 'masajes') / suma(porHora, 'masajes')) * 100
      ),
      pctTarde: Math.round(
        (suma(porHora.filter((h) => h.hora_del_dia >= 13), 'recuperacion') / suma(porHora, 'recuperacion')) * 100
      ),
      primera: completas[0],
      ultima: completas[completas.length - 1],
      alta: mayor(completas, 'total'),
      // El bajon no es el minimo (el minimo es enero, cuando apenas arrancaba),
      // sino la semana que mas cayo respecto a la anterior
      caida: completas.slice(1).reduce((peor, s, i) => {
        const baja = completas[i].total - s.total
        return baja > (peor?.baja ?? 0) ? { semana: s, previa: completas[i], baja } : peor
      }, null),
      parciales: porSemana.filter((s) => s.dias === 1),
      areas: tendencias.map((a) => ({
        ...a,
        cambio: a.visitas_inicio === 0 ? null : Math.round(((a.visitas_fin - a.visitas_inicio) / a.visitas_inicio) * 100),
        pctMasajes: Math.round((a.masajes / a.total) * 100),
      })),
    }
  }, [datos])

  const crecimiento = Math.round(((t.ultima.total - t.primera.total) / t.primera.total) * 100)

  return (
    <>
      <button type="button" className="control" onClick={() => dialogo.current?.showModal()}>
        📈 Tendencias
      </button>

      <dialog
        ref={dialogo}
        className="panel"
        onClick={(e) => e.target === dialogo.current && dialogo.current.close()}
      >
        <div className="panel-encabezado">
          <h2 className="subtitulo">Qué está pasando</h2>
          <button type="button" className="control" onClick={() => dialogo.current?.close()}>
            Cerrar
          </button>
        </div>

        <div className="panel-cuerpo">
          <section>
            <h3 className="panel-titulo">El día está partido en dos</h3>
            <p>
              Los masajes son de mañana y la recuperación física de tarde. El pico de masajes son las{' '}
              <strong>{t.picoMasajes.hora_del_dia}:00</strong> ({numero(t.picoMasajes.masajes)} visitas) y el de
              recuperación las <strong>{t.picoRecuperacion.hora_del_dia}:00</strong> (
              {numero(t.picoRecuperacion.recuperacion)}). El {t.pctManana}% de los masajes ocurre antes de las 12:00
              y el {t.pctTarde}% de la recuperación después de las 13:00.
            </p>
          </section>

          <section>
            <h3 className="panel-titulo">El semestre va en subida</h3>
            <p>
              De <strong>{numero(t.primera.total)} visitas</strong> en la semana del {t.primera.inicio} a{' '}
              <strong>{numero(t.ultima.total)}</strong> en la del {t.ultima.inicio}: {crecimiento}% más. La semana
              más alta fue la del {t.alta.inicio} con {numero(t.alta.total)}.
              {t.caida && (
                <>
                  {' '}
                  El único frenón fue la semana del {t.caida.semana.inicio}, que pasó de{' '}
                  {numero(t.caida.previa.total)} a {numero(t.caida.semana.total)} visitas
                  {enSemanaSanta(t.caida.semana.inicio) && ' (Semana Santa)'}.
                </>
              )}
              {t.parciales.length > 0 && (
                <>
                  {' '}
                  Las semanas del {t.parciales.map((s) => s.inicio).join(' y ')} se ven cortas porque solo tuvieron
                  un día de servicio.
                </>
              )}
            </p>
          </section>

          <section>
            <h3 className="panel-titulo">Cada área lleva su propio camino</h3>
            <p className="nota">Comparando enero-marzo contra abril-junio.</p>
            <ul className="panel-lista">
              {t.areas.map((a) => (
                <li key={a.area}>
                  <span className="panel-area">
                    <strong>{a.area}</strong>
                    <span className="cambio">
                      {a.cambio === null ? 'nueva' : `${a.cambio >= 0 ? '▲ +' : '▼ '}${a.cambio}%`}
                    </span>
                  </span>
                  <span className="nota">
                    De {numero(a.visitas_inicio)} visitas a {numero(a.visitas_fin)}.{' '}
                    {a.pctMasajes >= 60
                      ? `Va sobre todo a masajes (${a.pctMasajes}% de sus visitas)`
                      : a.pctMasajes <= 40
                        ? `Va sobre todo a recuperación (${100 - a.pctMasajes}% de sus visitas)`
                        : 'Se reparte parejo entre las dos actividades'}
                    , con más gente a las {a.hora_pico}:00.
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </dialog>
    </>
  )
}

function App() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [tooltip, tooltipElemento] = useTooltip()
  const [tema, alternarTema] = useTema()

  useEffect(() => {
    const rutas = ['resumen', 'por-dia', 'por-hora', 'por-area', 'por-semana', 'tendencias', 'usuarios']
    Promise.all(rutas.map((r) => api(`/api/${r}`)))
      .then(([resumen, porDia, porHora, porArea, porSemana, tendencias, usuarios]) =>
        setDatos({ resumen, porDia, porHora, porArea, porSemana, tendencias, usuarios })
      )
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="contenedor"><div className="alerta" role="alert">{error}</div></div>
  if (!datos) return <div className="contenedor"><p className="nota">Cargando estadísticas…</p></div>

  const { resumen } = datos

  return (
    <div className="contenedor">
      <header className="encabezado">
        <div>
          <p className="etiqueta">Softtek · Amenidades</p>
          <h1 className="titulo">Masajes y recuperación física</h1>
          <p className="nota">Martes y jueves, enero a junio de 2026</p>
        </div>
        <div className="acciones">
          <Tendencias datos={datos} />
          <button type="button" className="control tema" onClick={alternarTema}>
            {tema === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro'}
          </button>
        </div>
      </header>

      <section className="indicadores">
        <div className="tarjeta indicador principal">
          <span className="indicador-etiqueta">Asistencia total</span>
          <span className="indicador-heroe">{pct(resumen.pct_asistencia_total)}</span>
          <span className="nota">
            {numero(resumen.usuarios_asistieron)} de {numero(resumen.total_usuarios)} colaboradores fueron al menos a
            una actividad
          </span>
        </div>
        <Indicador etiqueta="Visitas totales" valor={numero(resumen.total_visitas)} />
        <div className="tarjeta indicador">
          <span className="indicador-etiqueta">Fueron a ambas</span>
          <span className="indicador-valor">{numero(resumen.usuarios_ambas)}</span>
          <span className="nota">{pct(resumen.pct_usuarios_ambas)} de los colaboradores</span>
          <ul className="desglose">
            {[
              ['Solo masajes', 'usuarios_solo_masajes', 'pct_usuarios_solo_masajes', ACTIVIDADES[0].color],
              [
                'Solo recuperación',
                'usuarios_solo_recuperacion',
                'pct_usuarios_solo_recuperacion',
                ACTIVIDADES[1].color,
              ],
            ].map(([titulo, campo, campoPct, color]) => (
              <li key={campo}>
                <span className="desglose-nombre">
                  <span className="muestra" style={{ background: color }} />
                  {titulo}
                </span>
                <span className="desglose-dato">
                  <strong>{numero(resumen[campo])}</strong> · {pct(resumen[campoPct])}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Indicador
          etiqueta="Visitas por persona a la semana"
          valor={promedio(resumen.prom_semanal_total)}
          detalle={`Promedio de las ${numero(resumen.total_usuarios)} personas en las ${numero(
            resumen.semanas
          )} semanas · Masajes ${promedio(resumen.prom_semanal_masajes)} · Recuperación ${promedio(
            resumen.prom_semanal_recuperacion
          )}`}
        />
      </section>

      <div className="rejilla-2">
        <RepartoVisitas resumen={resumen} tooltip={tooltip} />
        <PorDia datos={datos.porDia} tooltip={tooltip} />
      </div>

      <AreaActividad datos={datos.porArea} tooltip={tooltip} />
      <PorHora datos={datos.porHora} tooltip={tooltip} />
      <Histograma datos={datos.porSemana} tooltip={tooltip} />
      <Usuarios datos={datos.usuarios} />

      {tooltipElemento}
    </div>
  )
}

export default App
