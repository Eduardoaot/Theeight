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
      <button onClick={() => editar(p.id_producto)}>Editar</button>
      <button className="peligro" onClick={() => eliminar(p.id_producto, p.nombre_producto)}>
        Eliminar
      </button>
    </td>
  )

  return (
    <div className="contenedor">
      <h1>Tiendita El Eight</h1>
      {error && <p className="error">{error}</p>}

      <form className="formulario" onSubmit={guardar}>
        <h2>{editandoId ? `Editar producto ${editandoId}` : 'Agregar producto'}</h2>
        <input name="nombre_producto" placeholder="Nombre" value={formulario.nombre_producto} onChange={cambiar} required />
        <input name="precio_producto" type="number" step="0.01" min="0" placeholder="Precio" value={formulario.precio_producto} onChange={cambiar} required />
        <input name="descripcion_producto" placeholder="Descripción" value={formulario.descripcion_producto} onChange={cambiar} />
        <input name="cantidad" type="number" min="0" placeholder="Cantidad" value={formulario.cantidad} onChange={cambiar} required />
        <div className="botones">
          <button type="submit">{editandoId ? 'Guardar cambios' : 'Agregar'}</button>
          {editandoId && (
            <button type="button" className="secundario" onClick={cancelar}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="barra">
        <span>Total de productos: {productos.length}</span>
        <button onClick={cargarPorComprar}>Restablecimiento</button>
      </div>

      {porComprar && (
        <section className="restablecer">
          <div className="barra">
            <h2>Productos por comprar</h2>
            <button className="secundario" onClick={() => setPorComprar(null)}>
              Cerrar
            </button>
          </div>
          <p>Productos de más de $100 que tienen 10 piezas o menos.</p>
          {porComprar.length === 0 ? (
            <p>No hay nada que comprar.</p>
          ) : (
            <div className="tabla">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th>Hay</th>
                    <th>Comprar</th>
                    <th>Costo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {porComprar.map((p) => (
                    <tr key={p.id_producto}>
                      <td>{p.id_producto}</td>
                      <td>{p.nombre_producto}</td>
                      <td>{pesos(p.precio_producto)}</td>
                      <td>{p.cantidad}</td>
                      <td>{p.piezas_a_comprar}</td>
                      <td>{pesos(p.costo_producto)}</td>
                      {acciones(p)}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total">
                    <td colSpan="5">Total a comprar</td>
                    <td>{pesos(porComprar[0].total_compra)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}

      <h2>Todos los productos</h2>
      <div className="tabla">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Producto</th>
              <th>Precio</th>
              <th>Descripción</th>
              <th>Cantidad</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id_producto}>
                <td>{p.id_producto}</td>
                <td>{p.nombre_producto}</td>
                <td>{pesos(p.precio_producto)}</td>
                <td>{p.descripcion_producto}</td>
                <td>{p.cantidad}</td>
                {acciones(p)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default App
