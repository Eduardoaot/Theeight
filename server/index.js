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

// CALL devuelve [filas, info]; las filas vienen en result[0]
app.get('/api/productos', async (req, res) => {
  try {
    const [result] = await db.query('CALL sp_listar_productos()')
    res.json(result[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/productos/por-comprar', async (req, res) => {
  try {
    const [result] = await db.query('CALL sp_productos_por_comprar()')
    res.json(result[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(3001, () => console.log('API en http://localhost:3001'))
