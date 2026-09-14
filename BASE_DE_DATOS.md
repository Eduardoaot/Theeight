# Base de datos - Tiendita El Eight

Motor: **MySQL 8**. Script completo: [database/tiendita.sql](database/tiendita.sql)

## Tabla `productos`

| Columna                | Tipo          | Descripción                          |
|------------------------|---------------|--------------------------------------|
| `id_producto`          | INT (PK, AI)  | Identificador del producto           |
| `nombre_producto`      | VARCHAR(100)  | Nombre                               |
| `precio_producto`      | DECIMAL(10,2) | Precio en pesos                      |
| `descripcion_producto` | VARCHAR(255)  | Descripción corta                    |
| `cantidad`             | INT           | Piezas en existencia                 |

> Se agregó `cantidad` porque sin ella no se puede saber cuántos hay de cada producto.

## Regla de restablecimiento

Los productos que cuestan **más de $100** siempre deben tener **más de 10 piezas**.
Si tienen 10 o menos, hay que comprar hasta llegar a 11.

## Funciones

| Función | Qué hace |
|---------|----------|
| `fn_necesita_compra(precio, cantidad)` | Regresa verdadero si `precio > 100` y `cantidad <= 10` |
| `fn_piezas_faltantes(cantidad)` | Regresa cuántas piezas faltan para llegar a 11 |

## Triggers

| Trigger | Cuándo | Qué hace |
|---------|--------|----------|
| `trg_productos_before_insert` | Antes de insertar | Rechaza precio o cantidad negativos |
| `trg_productos_before_update` | Antes de actualizar | Rechaza precio o cantidad negativos |

## Procedimientos almacenados

| Procedimiento | Qué hace | Lo usa |
|---------------|----------|--------|
| `sp_listar_productos()` | Lista todos los productos con su cantidad | Tabla principal |
| `sp_productos_por_comprar()` | Lista los que cumplen la regla de restablecimiento | Botón "Restablecimiento" |

La consulta principal del restablecimiento es:

```sql
SELECT id_producto, nombre_producto, precio_producto, cantidad,
       fn_piezas_faltantes(cantidad) AS piezas_a_comprar
FROM productos
WHERE fn_necesita_compra(precio_producto, cantidad);
```

Que equivale a:

```sql
SELECT * FROM productos
WHERE precio_producto > 100 AND cantidad <= 10;
```

## Pruebas

```sql
CALL sp_listar_productos();        -- 30 productos
CALL sp_productos_por_comprar();   -- 7 productos

-- El trigger debe rechazar esto:
UPDATE productos SET cantidad = -5 WHERE id_producto = 1;
```

## Cómo correr el proyecto

1. Ejecutar el script en MySQL:
   ```
   mysql -u root -p < database/tiendita.sql
   ```
2. Ajustar usuario y contraseña en [server/index.js](server/index.js).
3. Instalar dependencias: `npm install`
4. En una terminal: `npm run server` (API en el puerto 3001)
5. En otra terminal: `npm run dev` y abrir http://localhost:5173

## Arquitectura

```
React (Vite)  --fetch /api-->  Express (server/index.js)  --CALL-->  MySQL
```

React no se conecta directo a MySQL; el servidor Express llama a los procedimientos almacenados.
