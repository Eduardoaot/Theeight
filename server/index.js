import express from 'express'
import cors from 'cors'
import mysql from 'mysql2/promise'

// Ajusta usuario y contraseña de tu MySQL
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'admin',
  database: 'tiendita_el_eight',
})

const app = express()
app.use(cors())
app.use(express.json())

// Llama al unico procedimiento; CALL devuelve [filas, info] y las filas vienen en result[0]
// `conexion` permite usarlo dentro de una transaccion
async function spProductos(accion, id = null, p = {}, conexion = db) {
  const [result] = await conexion.query('CALL sp_productos(?, ?, ?, ?, ?, ?)', [
    accion,
    id,
    p.nombre_producto ?? null,
    p.precio_producto ?? null,
    p.descripcion_producto ?? null,
    p.cantidad ?? null,
  ])
  return result[0]
}

// Envuelve cada ruta para responder el error de MySQL (por ejemplo, el del trigger)
const ruta = (fn) => async (req, res) => {
  try {
    res.json(await fn(req))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

app.get('/api/productos', ruta(() => spProductos('LEER')))
app.get('/api/productos/por-comprar', ruta(() => spProductos('LEER_COMPRAR')))
app.get('/api/productos/similares', ruta((req) =>
  spProductos('BUSCAR_SIMILARES', req.query.excluir || null, { nombre_producto: req.query.nombre || null })
))

// Reactiva un producto. Si viene `desactivar_id` (se estaba editando otro producto que
// resulto ser el mismo), ese se desactiva en la misma transaccion para no duplicarlo.
app.post('/api/productos/:id/reactivar', ruta(async (req) => {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const resultado = await spProductos('REACTIVAR', req.params.id, req.body, conexion)
    if (req.body.desactivar_id) {
      await spProductos('ELIMINAR', req.body.desactivar_id, {}, conexion)
    }
    await conexion.commit()
    return resultado
  } catch (err) {
    await conexion.rollback()
    throw err
  } finally {
    conexion.release()
  }
}))

app.post('/api/productos', ruta((req) => spProductos('INSERTAR', null, req.body)))
app.put('/api/productos/:id', ruta((req) => spProductos('ACTUALIZAR', req.params.id, req.body)))
app.delete('/api/productos/:id', ruta((req) => spProductos('ELIMINAR', req.params.id)))

app.listen(3001, () => console.log('API en http://localhost:3001'))
