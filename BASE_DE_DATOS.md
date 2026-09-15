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
| `estatus`              | ENUM('ACTIVO','DESACTIVADO') | Borrado lógico; por defecto `ACTIVO` |
| `fecha_baja`           | DATETIME      | Cuándo se desactivó (`NULL` si está activo) |

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
| `trg_productos_before_update` | Antes de actualizar | Rechaza precio o cantidad negativos; pone o limpia `fecha_baja` |
| `trg_productos_before_delete` | Antes de borrar | Rechaza el `DELETE` (los productos solo se desactivan) |

## Vista

| Vista | Qué hace | La usa |
|-------|----------|--------|
| `vw_productos` | Muestra los productos activos con su cantidad | Acción `LEER` del procedimiento |

```sql
SELECT * FROM vw_productos ORDER BY id_producto;
```

## Procedimiento almacenado `sp_productos`

Un solo procedimiento hace todo: leer, insertar, actualizar y eliminar.

```sql
CALL sp_productos(p_accion, p_id, p_nombre, p_precio, p_descripcion, p_cantidad);
```

| `p_accion` | Qué hace | Parámetros que usa | Regresa |
|------------|----------|--------------------|---------|
| `LEER` | Todos los productos (desde `vw_productos`) | ninguno | Lista de productos |
| `LEER_COMPRAR` | Productos por comprar, con costo y total | ninguno | Lista por comprar |
| `INSERTAR` | Agrega un producto | nombre, precio, descripción, cantidad | `id_producto` nuevo |
| `ACTUALIZAR` | Cambia un producto | id + los campos a cambiar (`NULL` = no cambiar) | `id_producto` |
| `ELIMINAR` | Desactiva un producto (borrado lógico) | id | `filas_eliminadas` |
| `BUSCAR_SIMILARES` | Productos con nombre parecido (`LIKE`), activos y desactivados | id a excluir (o `NULL`), nombre (`NULL` = todos) | Lista con `estatus` y `fecha_baja` |
| `REACTIVAR` | Vuelve a activar un producto desactivado | id + los campos a cambiar (`NULL` = no cambiar) | `id_producto` |

Un nombre es "parecido" si uno contiene al otro o si comparten la primera palabra (de 3 letras o más).
Por ejemplo, `Leche deslactosada` encuentra `Leche entera 1 L`.

Cualquier otra acción lanza el error `Accion no valida`.
Los triggers siguen validando: un `INSERTAR` o `ACTUALIZAR` con precio o cantidad negativos es rechazado.

Ejemplos:

```sql
CALL sp_productos('LEER',         NULL, NULL, NULL, NULL, NULL);
CALL sp_productos('LEER_COMPRAR', NULL, NULL, NULL, NULL, NULL);
CALL sp_productos('INSERTAR',     NULL, 'Sal 1 kg', 12.00, 'Sal de mesa', 20);
CALL sp_productos('ACTUALIZAR',   1,    NULL, NULL, NULL, 50);   -- solo cambia la cantidad
CALL sp_productos('ELIMINAR',     31,   NULL, NULL, NULL, NULL);
```

### Acción `LEER_COMPRAR`

Columnas que regresa:

| Columna | Cálculo |
|---------|---------|
| `piezas_a_comprar` | `11 - cantidad` |
| `costo_producto` | `precio_producto * piezas_a_comprar` |
| `total_compra` | Suma de `costo_producto` de todos los productos a comprar (mismo valor en cada fila) |

La consulta del restablecimiento es:

```sql
SELECT id_producto, nombre_producto, precio_producto, cantidad,
       fn_piezas_faltantes(cantidad) AS piezas_a_comprar,
       precio_producto * fn_piezas_faltantes(cantidad) AS costo_producto,
       SUM(precio_producto * fn_piezas_faltantes(cantidad)) OVER () AS total_compra
FROM productos
WHERE fn_necesita_compra(precio_producto, cantidad)
ORDER BY cantidad;
```

Que equivale a (sin funciones):

```sql
SELECT id_producto, nombre_producto, precio_producto, cantidad,
       11 - cantidad AS piezas_a_comprar,
       precio_producto * (11 - cantidad) AS costo_producto,
       SUM(precio_producto * (11 - cantidad)) OVER () AS total_compra
FROM productos
WHERE precio_producto > 100 AND cantidad <= 10
ORDER BY cantidad;
```

`SUM(...) OVER ()` es una función de ventana (MySQL 8): suma todas las filas sin agruparlas.

## Pruebas

```sql
CALL sp_productos('LEER', NULL, NULL, NULL, NULL, NULL);          -- 30 productos
CALL sp_productos('LEER_COMPRAR', NULL, NULL, NULL, NULL, NULL);  -- 7 productos, total_compra = 6330.00

-- El trigger debe rechazar esto:
CALL sp_productos('ACTUALIZAR', 1, NULL, NULL, NULL, -5);
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
React (Vite)  --fetch /api-->  Express (server/index.js)  --CALL sp_productos-->  MySQL
```

React no se conecta directo a MySQL; todas las rutas del servidor llaman a `sp_productos`:

| Ruta | Acción |
|------|--------|
| `GET /api/productos` | `LEER` |
| `GET /api/productos/por-comprar` | `LEER_COMPRAR` |
| `POST /api/productos` | `INSERTAR` |
| `PUT /api/productos/:id` | `ACTUALIZAR` |
| `DELETE /api/productos/:id` | `ELIMINAR` |
| `GET /api/productos/similares?nombre=&excluir=` | `BUSCAR_SIMILARES` |
| `POST /api/productos/:id/reactivar` | `REACTIVAR` (+ `ELIMINAR` de `desactivar_id` en la misma transacción) |

Antes de insertar o de cambiar el nombre de un producto, React busca productos parecidos.
Si hay alguno, muestra un pop up para reactivarlo tal como estaba, reactivarlo con los datos
corregidos a mano, o guardar el dato como nuevo. Al editar, si se reactiva otro producto,
el que se estaba editando se desactiva para que no queden duplicados.
