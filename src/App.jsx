import { useCallback, useEffect, useState } from 'react'

const pesos = (n) => `$${Number(n).toFixed(2)}`

const formularioVacio = {
  nombre_producto: '',
  precio_producto: '',
  descripcion_producto: '',
  cantidad: '',
}

async function api(url, opciones = {}) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  })
  const datos = await r.json()
  if (!r.ok) throw new Error(datos.error)
  return datos
}

const campos = [
  { nombre: 'nombre_producto', etiqueta: 'Nombre' },
  { nombre: 'precio_producto', etiqueta: 'Precio', tipo: 'number', step: '0.01' },
  { nombre: 'descripcion_producto', etiqueta: 'Descripción' },
  { nombre: 'cantidad', etiqueta: 'Cantidad', tipo: 'number' },
]

const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-MX') : '')

// Pop up con los productos parecidos al que se quiere guardar.
// modo 'insertar' | 'actualizar'; datos = lo que el usuario escribio en el formulario.
function DialogoSimilares({ modo, editandoId, datos, candidatos, onGuardar, onReactivar, onCerrar }) {
  const [elegidoId, setElegidoId] = useState(null)
  const [cambios, setCambios] = useState(null)

  useEffect(() => {
    const teclado = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', teclado)
    return () => window.removeEventListener('keydown', teclado)
  }, [onCerrar])

  // "Es el mismo": se precarga con lo escrito; si un campo va vacio, con el dato anterior
  const esElMismo = (p) => {
    setElegidoId(p.id_producto)
    setCambios(
      Object.fromEntries(
        campos.map(({ nombre }) => [
          nombre,
          datos[nombre] !== '' && datos[nombre] != null ? datos[nombre] : p[nombre] ?? '',
        ])
      )
    )
  }

  const reactivarConCambios = (e) => {
    e.preventDefault()
    onReactivar(elegidoId, {
      ...cambios,
      precio_producto: Number(cambios.precio_producto),
      cantidad: Number(cambios.cantidad),
    })
  }

  const hayDatos = datos.nombre_producto.trim() !== ''

  return (
    <div className="fondo-dialogo" onClick={onCerrar}>
      <div
        className="dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-dialogo"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="subtitulo" id="titulo-dialogo">
            {hayDatos ? 'Hay productos parecidos' : 'Productos desactivados'}
          </h2>
          <p className="nota">
            {hayDatos
              ? `${modo === 'insertar' ? 'Estás agregando' : `Estás cambiando el producto ${editandoId} a`} "${datos.nombre_producto}". ¿Es alguno de estos?`
              : 'Elige el producto que quieres volver a activar.'}
          </p>
          {modo === 'actualizar' && (
            <p className="nota">
              Si reactivas uno, el producto {editandoId} se desactiva para que no quede duplicado.
            </p>
          )}
        </div>

        <ul className="lista-similares">
          {candidatos.map((p) => {
            const desactivado = p.estatus === 'DESACTIVADO'
            const elegido = elegidoId === p.id_producto
            return (
              <li key={p.id_producto} className={`similar ${elegido ? 'elegido' : ''}`}>
                <div className="barra">
                  <span className="similar-nombre">
                    <span className="id">{p.id_producto}</span> {p.nombre_producto}
                  </span>
                  <span className={`insignia ${desactivado ? 'insignia-desactivado' : ''}`}>
                    {desactivado ? `Desactivado ${fecha(p.fecha_baja)}` : 'Activo'}
                  </span>
                </div>
                <div className="similar-datos">
                  <span>{pesos(p.precio_producto)}</span>
                  <span>{p.cantidad} piezas</span>
                  {p.descripcion_producto && <span>{p.descripcion_producto}</span>}
                </div>

                {!desactivado && <p className="nota">Este producto ya existe y está activo.</p>}

                {desactivado && !elegido && (
                  <div className="botones">
                    <button className="boton boton-chico boton-primario" onClick={() => onReactivar(p.id_producto, null)}>
                      Reactivar como estaba
                    </button>
                    <button className="boton boton-chico boton-claro" onClick={() => esElMismo(p)}>
                      Es el mismo, actualizarlo
                    </button>
                  </div>
                )}

                {elegido && (
                  <form className="formulario-reactivar" onSubmit={reactivarConCambios}>
                    <p className="nota">Corrige los datos y se reactivará con ellos.</p>
                    {campos.map(({ nombre, etiqueta, tipo, step }) => (
                      <label className="campo" key={nombre}>
                        <span>{etiqueta}</span>
                        <input
                          name={nombre}
                          type={tipo}
                          step={step}
                          min={tipo === 'number' ? '0' : undefined}
                          value={cambios[nombre]}
                          onChange={(e) => setCambios({ ...cambios, [nombre]: e.target.value })}
                          required={nombre !== 'descripcion_producto'}
                        />
                        <small className="antes">Antes: {p[nombre] ?? '—'}</small>
                      </label>
                    ))}
                    <div className="botones">
                      <button type="submit" className="boton boton-chico boton-primario">
                        Reactivar con estos datos
                      </button>
                      <button type="button" className="boton boton-chico boton-claro" onClick={() => setElegidoId(null)}>
                        Volver
                      </button>
                    </div>
                  </form>
                )}
              </li>
            )
          })}
        </ul>

        <div className="botones">
          {hayDatos && (
            <button className="boton boton-acento" onClick={onGuardar}>
              {modo === 'insertar' ? 'No, agregar como nuevo' : 'No, guardar mis cambios'}
            </button>
          )}
          <button className="boton boton-claro" onClick={onCerrar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [productos, setProductos] = useState([])
  const [porComprar, setPorComprar] = useState(null)
  const [formulario, setFormulario] = useState(formularioVacio)
  const [editandoId, setEditandoId] = useState(null)
  const [error, setError] = useState('')
  const [dialogo, setDialogo] = useState(null)

  const cargarProductos = () =>
    api('/api/productos').then(setProductos).catch((e) => setError(e.message))

  const cargarPorComprar = () =>
    api('/api/productos/por-comprar').then(setPorComprar).catch((e) => setError(e.message))

  useEffect(() => {
    cargarProductos()
  }, [])

  // Recarga ambas listas despues de insertar, actualizar o eliminar
  const recargar = () => {
    cargarProductos()
    if (porComprar) cargarPorComprar()
  }

  const cambiar = (e) => setFormulario({ ...formulario, [e.target.name]: e.target.value })

  const buscarSimilares = (nombre) =>
    api(`/api/productos/similares?${new URLSearchParams({ nombre, excluir: editandoId ?? '' })}`)

  // Inserta o actualiza sin volver a validar (se llama directo o desde el pop up)
  const guardarDirecto = async () => {
    setDialogo(null)
    const datos = {
      ...formulario,
      precio_producto: Number(formulario.precio_producto),
      cantidad: Number(formulario.cantidad),
    }
    try {
      if (editandoId) {
        await api(`/api/productos/${editandoId}`, { method: 'PUT', body: JSON.stringify(datos) })
      } else {
        await api('/api/productos', { method: 'POST', body: JSON.stringify(datos) })
      }
      cancelar()
      recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  // Antes de guardar busca parecidos con LIKE:
  // al insertar solo importan los desactivados; al actualizar (si cambio el nombre) tambien los activos
  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const original = productos.find((x) => x.id_producto === editandoId)
      const cambioNombre = !original || original.nombre_producto !== formulario.nombre_producto.trim()
      if (cambioNombre) {
        const similares = await buscarSimilares(formulario.nombre_producto.trim())
        const candidatos = editandoId ? similares : similares.filter((p) => p.estatus === 'DESACTIVADO')
        if (candidatos.length > 0) {
          setDialogo({ datos: formulario, candidatos })
          return
        }
      }
      await guardarDirecto()
    } catch (err) {
      setError(err.message)
    }
  }

  const verDesactivados = async () => {
    setError('')
    try {
      const desactivados = (await buscarSimilares('')).filter((p) => p.estatus === 'DESACTIVADO')
      if (desactivados.length === 0) return setError('No hay productos desactivados')
      setDialogo({ datos: { ...formulario, nombre_producto: '' }, candidatos: desactivados })
    } catch (err) {
      setError(err.message)
    }
  }

  // cambios = null reactiva tal como estaba; si se editaba otro producto, ese se desactiva
  const reactivar = async (id, cambios) => {
    setDialogo(null)
    try {
      await api(`/api/productos/${id}/reactivar`, {
        method: 'POST',
        body: JSON.stringify({ ...cambios, desactivar_id: editandoId }),
      })
      cancelar()
      recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const cerrarDialogo = useCallback(() => setDialogo(null), [])

  // La lista por comprar no trae descripcion; se toma de la lista completa
  const editar = (id) => {
    const p = productos.find((x) => x.id_producto === id)
    setEditandoId(id)
    setFormulario({
      nombre_producto: p.nombre_producto,
      precio_producto: p.precio_producto,
      descripcion_producto: p.descripcion_producto ?? '',
      cantidad: p.cantidad,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const eliminar = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar "${nombre}"?`)) return
    setError('')
    try {
      await api(`/api/productos/${id}`, { method: 'DELETE' })
      if (editandoId === id) cancelar()
      recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const cancelar = () => {
    setEditandoId(null)
    setFormulario(formularioVacio)
  }

  const acciones = (p) => (
    <td className="acciones">
      <button className="boton boton-chico boton-claro" onClick={() => editar(p.id_producto)}>
        Editar
      </button>
      <button
        className="boton boton-chico boton-peligro"
        onClick={() => eliminar(p.id_producto, p.nombre_producto)}
      >
        Eliminar
      </button>
    </td>
  )

  return (
    <div className="contenedor">
      <header className="encabezado">
        <div>
          <p className="etiqueta">Tienda de la esquina</p>
          <h1 className="titulo">Tiendita El Eight</h1>
        </div>
        <div className="resumen">
          <span className="resumen-numero">{productos.length}</span>
          <span className="resumen-texto">productos</span>
        </div>
      </header>

      {error && (
        <div className="alerta" role="alert">
          <span>{error}</span>
          <button className="boton boton-chico boton-claro" onClick={() => setError('')}>
            Cerrar
          </button>
        </div>
      )}

      <form className={`tarjeta formulario ${editandoId ? 'editando' : ''}`} onSubmit={guardar}>
        <h2 className="subtitulo">
          {editandoId ? `Editar producto ${editandoId}` : 'Agregar producto'}
        </h2>
        <label className="campo">
          <span>Nombre</span>
          <input name="nombre_producto" value={formulario.nombre_producto} onChange={cambiar} required />
        </label>
        <label className="campo">
          <span>Precio</span>
          <input name="precio_producto" type="number" step="0.01" min="0" value={formulario.precio_producto} onChange={cambiar} required />
        </label>
        <label className="campo">
          <span>Descripción</span>
          <input name="descripcion_producto" value={formulario.descripcion_producto} onChange={cambiar} />
        </label>
        <label className="campo">
          <span>Cantidad</span>
          <input name="cantidad" type="number" min="0" value={formulario.cantidad} onChange={cambiar} required />
        </label>
        <div className="botones">
          <button type="submit" className="boton boton-primario">
            {editandoId ? 'Guardar cambios' : 'Agregar'}
          </button>
          {editandoId && (
            <button type="button" className="boton boton-claro" onClick={cancelar}>
              Cancelar
            </button>
          )}
          <button type="button" className="boton boton-claro" onClick={verDesactivados}>
            Ver desactivados
          </button>
        </div>
      </form>

      {dialogo && (
        <DialogoSimilares
          modo={editandoId ? 'actualizar' : 'insertar'}
          editandoId={editandoId}
          datos={dialogo.datos}
          candidatos={dialogo.candidatos}
          onGuardar={guardarDirecto}
          onReactivar={reactivar}
          onCerrar={cerrarDialogo}
        />
      )}

      <div className="barra">
        <h2 className="subtitulo">Inventario</h2>
        <button className="boton boton-acento" onClick={cargarPorComprar}>
          Restablecimiento
        </button>
      </div>

      {porComprar && (
        <section className="tarjeta restablecer">
          <div className="barra">
            <div>
              <h2 className="subtitulo">Productos por comprar</h2>
              <p className="nota">Productos de más de $100 que tienen 10 piezas o menos.</p>
            </div>
            <button className="boton boton-claro" onClick={() => setPorComprar(null)}>
              Cerrar
            </button>
          </div>
          {porComprar.length === 0 ? (
            <p className="nota">No hay nada que comprar.</p>
          ) : (
            <div className="tabla">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Producto</th>
                    <th className="numero">Precio</th>
                    <th className="numero">Hay</th>
                    <th className="numero">Comprar</th>
                    <th className="numero">Costo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {porComprar.map((p, i) => (
                    <tr key={p.id_producto} style={{ '--i': i }}>
                      <td className="id">{p.id_producto}</td>
                      <td>{p.nombre_producto}</td>
                      <td className="numero">{pesos(p.precio_producto)}</td>
                      <td className="numero">
                        <span className="insignia insignia-baja">{p.cantidad}</span>
                      </td>
                      <td className="numero">{p.piezas_a_comprar}</td>
                      <td className="numero">{pesos(p.costo_producto)}</td>
                      {acciones(p)}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total">
                    <td colSpan="5">Total a comprar</td>
                    <td className="numero">{pesos(porComprar[0].total_compra)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="tarjeta">
        <div className="tabla">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Producto</th>
                <th className="numero">Precio</th>
                <th>Descripción</th>
                <th className="numero">Cantidad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p, i) => (
                <tr key={p.id_producto} style={{ '--i': i }}>
                  <td className="id">{p.id_producto}</td>
                  <td>{p.nombre_producto}</td>
                  <td className="numero">{pesos(p.precio_producto)}</td>
                  <td className="descripcion">{p.descripcion_producto}</td>
                  <td className="numero">
                    <span className="insignia">{p.cantidad}</span>
                  </td>
                  {acciones(p)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default App
