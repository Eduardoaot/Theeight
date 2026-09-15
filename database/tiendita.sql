-- =============================================
-- Tiendita de la esquina "El Eight"
-- Motor: MySQL 8
-- =============================================

DROP DATABASE IF EXISTS tiendita_el_eight;
CREATE DATABASE tiendita_el_eight;
USE tiendita_el_eight;

-- ---------------------------------------------
-- 1. Tabla
-- ---------------------------------------------
CREATE TABLE productos (
    id_producto          INT AUTO_INCREMENT PRIMARY KEY,
    nombre_producto      VARCHAR(100)  NOT NULL,
    precio_producto      DECIMAL(10,2) NOT NULL,
    descripcion_producto VARCHAR(255),
    cantidad             INT NOT NULL DEFAULT 0,
    estatus              ENUM('ACTIVO', 'DESACTIVADO') NOT NULL DEFAULT 'ACTIVO',
    fecha_baja           DATETIME NULL
);

-- ---------------------------------------------
-- 2. Vista
-- ---------------------------------------------

-- Productos activos con su cantidad (los desactivados no se muestran)
CREATE VIEW vw_productos AS
SELECT id_producto, nombre_producto, precio_producto,
       descripcion_producto, cantidad
FROM productos
WHERE estatus = 'ACTIVO';

DELIMITER //

-- ---------------------------------------------
-- 3. Funciones
-- ---------------------------------------------

-- Devuelve 1 si el producto hay que comprarlo (precio > 100 y 10 o menos piezas)
CREATE FUNCTION fn_necesita_compra(p_precio DECIMAL(10,2), p_cantidad INT)
RETURNS BOOLEAN
DETERMINISTIC
BEGIN
    RETURN p_precio > 100 AND p_cantidad <= 10;
END //

-- Cuantas piezas faltan para tener mas de 10 (minimo 11)
CREATE FUNCTION fn_piezas_faltantes(p_cantidad INT)
RETURNS INT
DETERMINISTIC
BEGIN
    IF p_cantidad >= 11 THEN
        RETURN 0;
    END IF;
    RETURN 11 - p_cantidad;
END //

-- ---------------------------------------------
-- 4. Triggers (validan precio y cantidad)
-- ---------------------------------------------
CREATE TRIGGER trg_productos_before_insert
BEFORE INSERT ON productos
FOR EACH ROW
BEGIN
    IF NEW.precio_producto < 0 OR NEW.cantidad < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El precio y la cantidad no pueden ser negativos';
    END IF;
END //

CREATE TRIGGER trg_productos_before_update
BEFORE UPDATE ON productos
FOR EACH ROW
BEGIN
    IF NEW.precio_producto < 0 OR NEW.cantidad < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El precio y la cantidad no pueden ser negativos';
    END IF;

    -- Registra la fecha de baja al desactivar y la limpia al reactivar
    IF NEW.estatus = 'DESACTIVADO' AND OLD.estatus = 'ACTIVO' THEN
        SET NEW.fecha_baja = NOW();
    ELSEIF NEW.estatus = 'ACTIVO' THEN
        SET NEW.fecha_baja = NULL;
    END IF;
END //

-- Borrado logico: nunca se borra fisicamente un producto.
-- MySQL no permite que un trigger cambie un DELETE por un UPDATE en la
-- misma tabla (error 1442), asi que el trigger bloquea el DELETE y la
-- baja se hace con sp_productos('ELIMINAR', ...), que cambia el estatus.
CREATE TRIGGER trg_productos_before_delete
BEFORE DELETE ON productos
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se permite borrar productos; usa sp_productos(''ELIMINAR'', id, ...) para desactivarlo';
END //

-- ---------------------------------------------
-- 5. Procedimiento almacenado
-- ---------------------------------------------

-- Un solo procedimiento para todo (CRUD)
-- p_accion:
--   'LEER'          todos los productos (usa la vista)
--   'LEER_COMPRAR'  productos por comprar, con costo y total
--   'INSERTAR'      nuevo producto (nombre, precio, descripcion, cantidad)
--   'ACTUALIZAR'    cambia un producto por id (los parametros NULL no se cambian)
--   'ELIMINAR'      desactiva un producto por id (borrado logico)
--   'BUSCAR_SIMILARES'  productos con nombre parecido (LIKE), sin contar p_id
--   'REACTIVAR'     activa un producto desactivado (los parametros NULL no se cambian)
CREATE PROCEDURE sp_productos(
    IN p_accion      VARCHAR(20),
    IN p_id          INT,
    IN p_nombre      VARCHAR(100),
    IN p_precio      DECIMAL(10,2),
    IN p_descripcion VARCHAR(255),
    IN p_cantidad    INT
)
BEGIN
    CASE p_accion
        WHEN 'LEER' THEN
            SELECT * FROM vw_productos ORDER BY id_producto;

        -- costo_producto = precio * piezas a comprar
        -- total_compra   = suma del costo de todos los productos a comprar
        WHEN 'LEER_COMPRAR' THEN
            SELECT id_producto, nombre_producto, precio_producto, cantidad,
                   fn_piezas_faltantes(cantidad) AS piezas_a_comprar,
                   precio_producto * fn_piezas_faltantes(cantidad) AS costo_producto,
                   SUM(precio_producto * fn_piezas_faltantes(cantidad)) OVER () AS total_compra
            FROM productos
            WHERE estatus = 'ACTIVO'
              AND fn_necesita_compra(precio_producto, cantidad)
            ORDER BY cantidad;

        WHEN 'INSERTAR' THEN
            INSERT INTO productos (nombre_producto, precio_producto, descripcion_producto, cantidad)
            VALUES (p_nombre, p_precio, p_descripcion, IFNULL(p_cantidad, 0));
            SELECT LAST_INSERT_ID() AS id_producto;

        WHEN 'ACTUALIZAR' THEN
            UPDATE productos
            SET nombre_producto      = IFNULL(p_nombre, nombre_producto),
                precio_producto      = IFNULL(p_precio, precio_producto),
                descripcion_producto = IFNULL(p_descripcion, descripcion_producto),
                cantidad             = IFNULL(p_cantidad, cantidad)
            WHERE id_producto = p_id AND estatus = 'ACTIVO';
            SELECT p_id AS id_producto;

        -- Baja logica: solo cambia el estatus a DESACTIVADO
        WHEN 'ELIMINAR' THEN
            UPDATE productos
            SET estatus = 'DESACTIVADO'
            WHERE id_producto = p_id AND estatus = 'ACTIVO';
            SELECT ROW_COUNT() AS filas_eliminadas;

        -- Productos con nombre parecido (activos y desactivados), sin contar p_id.
        -- Es parecido si un nombre contiene al otro o comparten la primera palabra
        -- (de 3 letras o mas). Con p_nombre NULL o vacio regresa todos.
        WHEN 'BUSCAR_SIMILARES' THEN
            SELECT id_producto, nombre_producto, precio_producto,
                   descripcion_producto, cantidad, estatus, fecha_baja
            FROM productos
            WHERE (p_id IS NULL OR id_producto <> p_id)
              AND (p_nombre IS NULL OR TRIM(p_nombre) = ''
                   OR nombre_producto LIKE CONCAT('%', TRIM(p_nombre), '%')
                   OR TRIM(p_nombre) LIKE CONCAT('%', nombre_producto, '%')
                   OR (CHAR_LENGTH(SUBSTRING_INDEX(TRIM(p_nombre), ' ', 1)) >= 3
                       AND nombre_producto LIKE CONCAT('%', SUBSTRING_INDEX(TRIM(p_nombre), ' ', 1), '%')))
            ORDER BY estatus DESC, nombre_producto;

        -- Vuelve a activar un producto desactivado; los parametros NULL no se cambian
        WHEN 'REACTIVAR' THEN
            UPDATE productos
            SET estatus              = 'ACTIVO',
                nombre_producto      = IFNULL(p_nombre, nombre_producto),
                precio_producto      = IFNULL(p_precio, precio_producto),
                descripcion_producto = IFNULL(p_descripcion, descripcion_producto),
                cantidad             = IFNULL(p_cantidad, cantidad)
            WHERE id_producto = p_id AND estatus = 'DESACTIVADO';
            IF ROW_COUNT() = 0 THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El producto no existe o ya esta activo';
            END IF;
            SELECT p_id AS id_producto;

        ELSE
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Accion no valida';
    END CASE;
END //

DELIMITER ;

-- ---------------------------------------------
-- 6. Datos (30 productos)
-- ---------------------------------------------
INSERT INTO productos (nombre_producto, precio_producto, descripcion_producto, cantidad) VALUES
('Refresco de cola 600 ml',        18.00, 'Bebida gaseosa sabor cola',            40),
('Agua natural 1 L',               14.00, 'Agua purificada embotellada',          35),
('Leche entera 1 L',               28.50, 'Leche de vaca pasteurizada',           20),
('Pan de caja grande',             52.00, 'Pan blanco rebanado',                  12),
('Huevo 12 piezas',                48.00, 'Huevo blanco de gallina',              15),
('Arroz 1 kg',                     32.00, 'Arroz blanco grano largo',             25),
('Frijol negro 1 kg',              38.00, 'Frijol negro seleccionado',            18),
('Aceite vegetal 1 L',             45.00, 'Aceite comestible de soya',            10),
('Azucar 1 kg',                    30.00, 'Azucar estandar',                      22),
('Cafe soluble 200 g',            115.00, 'Cafe instantaneo clasico',              6),
('Detergente en polvo 2 kg',      125.00, 'Detergente para ropa',                 14),
('Papel higienico 12 rollos',     135.00, 'Papel higienico doble hoja',            4),
('Jabon de tocador 3 piezas',      42.00, 'Jabon con aroma suave',                 30),
('Shampoo 750 ml',                 98.00, 'Shampoo para todo tipo de cabello',     9),
('Atun en agua 140 g',             24.00, 'Lata de atun en agua',                 28),
('Mayonesa 390 g',                 55.00, 'Mayonesa con limon',                   11),
('Queso panela 400 g',            105.00, 'Queso fresco tipo panela',              3),
('Jamon de pavo 500 g',           110.00, 'Jamon rebanado de pavo',               12),
('Cereal de maiz 500 g',           68.00, 'Hojuelas de maiz tostadas',            16),
('Galletas surtidas 500 g',        58.00, 'Paquete de galletas variadas',         19),
('Cerveza 6 pack',                150.00, 'Seis latas de cerveza clara',          10),
('Tequila 750 ml',                280.00, 'Tequila blanco',                        2),
('Pañales etapa 3 40 piezas',     230.00, 'Pañales desechables para bebe',        13),
('Croquetas para perro 2 kg',     145.00, 'Alimento seco para perro adulto',       7),
('Cloro 1 L',                      22.00, 'Blanqueador desinfectante',            26),
('Suavizante de telas 1 L',        48.00, 'Suavizante con aroma floral',          14),
('Pasta dental 150 ml',            39.00, 'Crema dental con fluor',               21),
('Desodorante en aerosol',        102.00, 'Desodorante antitranspirante',         11),
('Chocolate en polvo 400 g',       72.00, 'Bebida de chocolate para leche',        8),
('Pila AA 4 piezas',              120.00, 'Pilas alcalinas tamaño AA',             5);

-- Prueba rapida
-- CALL sp_productos('LEER', NULL, NULL, NULL, NULL, NULL);
-- CALL sp_productos('LEER_COMPRAR', NULL, NULL, NULL, NULL, NULL);
-- CALL sp_productos('INSERTAR', NULL, 'Sal 1 kg', 12.00, 'Sal de mesa', 20);
-- CALL sp_productos('ACTUALIZAR', 1, NULL, NULL, NULL, 50);
-- CALL sp_productos('ELIMINAR', 31, NULL, NULL, NULL, NULL);
-- SELECT id_producto, estatus, fecha_baja FROM productos WHERE id_producto = 31;
-- DELETE FROM productos WHERE id_producto = 31;   -- falla: lo bloquea el trigger
-- CALL sp_productos('BUSCAR_SIMILARES', NULL, 'Sal de grano', NULL, NULL, NULL);
-- CALL sp_productos('REACTIVAR', 31, 'Sal de mar 1 kg', NULL, NULL, 15);
