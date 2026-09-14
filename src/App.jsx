import { useEffect, useState } from 'react'

const pesos = (n) => `$${Number(n).toFixed(2)}`

function App() {
  const [productos, setProductos] = useState([])
  const [porComprar, setPorComprar] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/productos')
      .then((r) => r.json())
      .then(setProductos)
      .catch(() => setError('No se pudo conectar con el servidor'))
  }, [])

  const verRestablecimiento = () => {
    fetch('/api/productos/por-comprar')
      .then((r) => r.json())
      .then(setPorComprar)
      .catch(() => setError('No se pudo conectar con el servidor'))
  }

  return (
    <div className="contenedor">
      <h1>Tiendita El Eight</h1>
      {error && <p className="error">{error}</p>}

      <div className="barra">
        <span>Total de productos: {productos.length}</span>
        <button onClick={verRestablecimiento}>Restablecimiento</button>
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
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th>Hay</th>
                  <th>Comprar</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <h2>Todos los productos</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Producto</th>
            <th>Precio</th>
            <th>Descripción</th>
            <th>Cantidad</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default App
