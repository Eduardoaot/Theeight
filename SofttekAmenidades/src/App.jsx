import { useEffect, useMemo, useState } from 'react'

const ACTIVIDADES = [
  { clave: 'masajes', nombre: 'Masajes', color: 'var(--serie-1)' },
  { clave: 'recuperacion', nombre: 'Recuperación física', color: 'var(--serie-2)' },
]

const FAVORITAS = ['Todas', 'Masajes', 'Recuperación física', 'Empate', 'Ninguna']

const numero = (n) => Number(n).toLocaleString('es-MX')
const pct = (n) => `${Number(n).toFixed(1)}%`

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

function PorActividad({ resumen, tooltip }) {
  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Personas por actividad</h2>
      <p className="nota">De {numero(resumen.total_usuarios)} colaboradores, cuántos fueron al menos una vez.</p>
      <div className="barras">
        {ACTIVIDADES.map((a) => (
          <Barra
            key={a.clave}
            nombre={a.nombre}
            valor={resumen[`usuarios_${a.clave}`]}
            tope={resumen.total_usuarios}
            color={a.color}
            texto={`${numero(resumen[`usuarios_${a.clave}`])} · ${pct(resumen[`pct_usuarios_${a.clave}`])}`}
            tooltip={tooltip}
          />
        ))}
      </div>
    </section>
  )
}

// Barra 100% con el reparto de visitas entre las dos actividades
function RepartoVisitas({ resumen, tooltip }) {
  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Reparto de visitas</h2>
      <p className="nota">{numero(resumen.total_visitas)} visitas en total.</p>
      <div className="apilada">
        {ACTIVIDADES.map((a) => (
          <div
            key={a.clave}
            className="segmento"
            style={{ flexBasis: `${resumen[`pct_visitas_${a.clave}`]}%`, background: a.color }}
            {...tooltip(`${a.nombre}\n${numero(resumen[`visitas_${a.clave}`])} visitas · ${pct(resumen[`pct_visitas_${a.clave}`])}`)}
          />
        ))}
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

function PorHora({ datos, tooltip }) {
  const { tope, marcas } = escala(Math.max(...datos.flatMap((d) => [d.masajes, d.recuperacion])))
  return (
    <section className="tarjeta">
      <div className="barra-titulo">
        <h2 className="subtitulo">Visitas por hora</h2>
        <Leyenda />
      </div>
      <div className="tabla">
        <div className="columnas">
          {marcas.map((m) => (
            <div key={m} className="rejilla" style={{ bottom: `${(m / tope) * 100}%` }}>
              <span>{m}</span>
            </div>
          ))}
          {datos.map((d) => (
            <div
              key={d.hora_del_dia}
              className="grupo-columnas"
              {...tooltip(
                `${d.hora_del_dia}:00 a ${d.hora_del_dia}:59\n` +
                  ACTIVIDADES.map((a) => `${a.nombre}: ${numero(d[a.clave])}`).join('\n')
              )}
            >
              {ACTIVIDADES.map((a) => (
                <div
                  key={a.clave}
                  className="columna"
                  style={{ height: `${(d[a.clave] / tope) * 100}%`, background: a.color }}
                />
              ))}
              <span className="etiqueta-x">{d.hora_del_dia}:00</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Top({ datos }) {
  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Quién fue más</h2>
      <p className="nota">Los 5 primeros lugares de cada actividad (los empates comparten lugar).</p>
      <div className="top">
        {ACTIVIDADES.map((a) => (
          <div key={a.clave}>
            <h3 className="top-titulo">
              <span className="muestra" style={{ background: a.color }} />
              {a.nombre}
            </h3>
            <ol className="top-lista">
              {datos
                .filter((t) => t.actividad === a.nombre)
                .map((t) => (
                  <li key={t.id_usuario}>
                    <span className="top-posicion">{t.posicion}</span>
                    <span>
                      {t.nombre_completo}
                      <span className="nota"> · {t.area}</span>
                    </span>
                    <strong>{t.veces} veces</strong>
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  )
}

function PorArea({ datos }) {
  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Por área</h2>
      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>Área</th>
              <th className="numero">Personas</th>
              <th className="numero">Masajes</th>
              <th className="numero">Recuperación</th>
              <th className="numero">Asistencia</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d) => (
              <tr key={d.area}>
                <td>{d.area}</td>
                <td className="numero">{d.usuarios}</td>
                <td className="numero">{numero(d.visitas_masajes)}</td>
                <td className="numero">{numero(d.visitas_recuperacion)}</td>
                <td className="numero">{pct(d.pct_asistencia)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Usuarios({ datos }) {
  const [busqueda, setBusqueda] = useState('')
  const [favorita, setFavorita] = useState('Todas')

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return datos.filter(
      (u) =>
        (favorita === 'Todas' || u.actividad_favorita === favorita) &&
        (texto === '' || `${u.nombre_completo} ${u.area}`.toLowerCase().includes(texto))
    )
  }, [datos, busqueda, favorita])

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
              <th>ID</th>
              <th>Nombre</th>
              <th>Área</th>
              <th className="numero">Masajes</th>
              <th className="numero">Recuperación</th>
              <th className="numero">Total</th>
              <th>Fue más a</th>
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

function App() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [tooltip, tooltipElemento] = useTooltip()

  useEffect(() => {
    const rutas = ['resumen', 'por-dia', 'por-hora', 'por-area', 'top?limite=5', 'usuarios']
    Promise.all(rutas.map((r) => api(`/api/${r}`)))
      .then(([resumen, porDia, porHora, porArea, top, usuarios]) =>
        setDatos({ resumen, porDia, porHora, porArea, top, usuarios })
      )
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="contenedor"><div className="alerta" role="alert">{error}</div></div>
  if (!datos) return <div className="contenedor"><p className="nota">Cargando estadísticas…</p></div>

  const { resumen } = datos

  return (
    <div className="contenedor">
      <header className="encabezado">
        <p className="etiqueta">Softtek · Amenidades</p>
        <h1 className="titulo">Masajes y recuperación física</h1>
        <p className="nota">Martes y jueves, enero a junio de 2026</p>
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
        <Indicador
          etiqueta="Fueron a ambas"
          valor={numero(resumen.usuarios_ambas)}
          detalle={`${pct(resumen.pct_usuarios_ambas)} de los colaboradores`}
        />
        <Indicador etiqueta="No fueron a ninguna" valor={numero(resumen.usuarios_ninguna)} />
      </section>

      <div className="rejilla-2">
        <PorActividad resumen={resumen} tooltip={tooltip} />
        <RepartoVisitas resumen={resumen} tooltip={tooltip} />
      </div>

      <div className="rejilla-2">
        <PorDia datos={datos.porDia} tooltip={tooltip} />
        <Top datos={datos.top} />
      </div>

      <PorHora datos={datos.porHora} tooltip={tooltip} />
      <PorArea datos={datos.porArea} />
      <Usuarios datos={datos.usuarios} />

      {tooltipElemento}
    </div>
  )
}

export default App
