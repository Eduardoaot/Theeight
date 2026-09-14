import { useEffect, useState } from 'react'

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

function App() {
  const [productos, setProductos] = useState([])
  const [porComprar, setPorComprar] = useState(null)
  const [formulario, setFormulario] = useState(formularioVacio)
  const [editandoId, setEditandoId] = useState(null)
  const [error, setError] = useState('')

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

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
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
        </div>
      </form>

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
