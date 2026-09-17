import express from 'express'
import cors from 'cors'
import mysql from 'mysql2/promise'

// Ajusta usuario y contraseña de tu MySQL
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'admin',
  database: 'Softtek_Amenidades',
  decimalNumbers: true, // SUM y porcentajes llegan como numero, no como texto
})

const app = express()
app.use(cors())

// Llama al unico procedimiento; CALL devuelve [filas, info] y las filas vienen en result[0]
async function spEstadisticas(accion, limite = null) {
  const [result] = await db.query('CALL sp_estadisticas(?, ?)', [accion, limite])
  return result[0]
}

const ruta = (fn) => async (req, res) => {
  try {
    res.json(await fn(req))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Solo lectura: unicamente rutas GET
app.get('/api/resumen', ruta(async () => (await spEstadisticas('RESUMEN'))[0]))
app.get('/api/usuarios', ruta(() => spEstadisticas('USUARIOS')))
app.get('/api/top', ruta((req) => spEstadisticas('TOP', Number(req.query.limite) || 5)))
app.get('/api/por-dia', ruta(() => spEstadisticas('POR_DIA')))
app.get('/api/por-semana', ruta(() => spEstadisticas('POR_SEMANA')))
app.get('/api/por-hora', ruta(() => spEstadisticas('POR_HORA')))
app.get('/api/por-area', ruta(() => spEstadisticas('POR_AREA')))
app.get('/api/tendencias', ruta(() => spEstadisticas('TENDENCIAS')))

app.listen(3002, () => console.log('API en http://localhost:3002'))
