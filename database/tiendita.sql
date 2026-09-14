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
    cantidad             INT NOT NULL DEFAULT 0
);

DELIMITER //

-- ---------------------------------------------
-- 2. Funciones
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
-- 3. Triggers (validan precio y cantidad)
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
END //

-- ---------------------------------------------
-- 4. Procedimientos almacenados
-- ---------------------------------------------

-- Todos los productos con su cantidad
CREATE PROCEDURE sp_listar_productos()
BEGIN
    SELECT id_producto, nombre_producto, precio_producto,
           descripcion_producto, cantidad
    FROM productos
    ORDER BY id_producto;
END //

-- Productos que hay que comprar (restablecimiento)
CREATE PROCEDURE sp_productos_por_comprar()
BEGIN
    SELECT id_producto, nombre_producto, precio_producto, cantidad,
           fn_piezas_faltantes(cantidad) AS piezas_a_comprar
    FROM productos
    WHERE fn_necesita_compra(precio_producto, cantidad)
    ORDER BY cantidad;
END //

DELIMITER ;

-- ---------------------------------------------
-- 5. Datos (30 productos)
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
-- CALL sp_listar_productos();
-- CALL sp_productos_por_comprar();
