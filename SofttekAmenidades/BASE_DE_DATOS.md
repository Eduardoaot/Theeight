# Base de datos - Softtek Amenidades

Motor: **MySQL 8**. Script completo: [database/softtek_amenidades.sql](database/softtek_amenidades.sql)

Estadísticas de asistencia de 200 colaboradores a dos amenidades: **masajes** y **recuperación física**.
Solo hay servicio **martes y jueves**. Por ahora el proyecto es **solo lectura** (sin insertar, actualizar ni borrar desde la app).

## Tablas

```
usuarios (200)
   │ 1
   ├──< registro_masajes       (una fila por visita)
   └──< registro_recuperacion  (una fila por visita)
```

| Tabla | Columnas | Nota |
|-------|----------|------|
| `usuarios` | `id_usuario`, `nombre`, `apellido`, `area` | 200 colaboradores |
| `registro_masajes` | `id_registro`, `id_usuario`, `fecha`, `hora` | Las veces que aparece un usuario = las veces que fue |
| `registro_recuperacion` | `id_registro`, `id_usuario`, `fecha`, `hora` | Igual que masajes |

Cada tabla de registro tiene `UNIQUE (id_usuario, fecha)`: una persona no puede ir dos veces el mismo día a la misma actividad.

Los datos son aleatorios de enero a junio de 2026 (52 martes y jueves, de 08:00 a 17:30).

## Funciones

| Función | Qué hace |
|---------|----------|
| `fn_es_martes_o_jueves(fecha)` | Verdadero si la fecha es martes o jueves (`DAYOFWEEK` 3 o 5) |
| `fn_nombre_dia(fecha)` | Regresa `'Martes'` o `'Jueves'` |
| `fn_porcentaje(parte, total)` | `parte * 100 / total` con 2 decimales; regresa 0 si el total es 0 |
| `fn_actividad_favorita(masajes, recuperacion)` | Discrimina a qué fue más: `Masajes`, `Recuperación física`, `Empate` o `Ninguna` |

## Triggers

| Trigger | Qué hace |
|---------|----------|
| `trg_masajes_before_insert` | Rechaza visitas que no sean martes o jueves, o fuera de 08:00 a 18:00 |
| `trg_recuperacion_before_insert` | Lo mismo para recuperación física |

## Vistas (donde están los joins)

### `vw_asistencia_usuario`: una fila por usuario

```sql
FROM usuarios u
LEFT JOIN (SELECT id_usuario, COUNT(*) AS veces FROM registro_masajes GROUP BY id_usuario) m
       ON m.id_usuario = u.id_usuario
LEFT JOIN (SELECT id_usuario, COUNT(*) AS veces FROM registro_recuperacion GROUP BY id_usuario) r
       ON r.id_usuario = u.id_usuario
```

- **LEFT JOIN** para que salgan los 200 usuarios, incluso los que nunca fueron (`COALESCE(..., 0)` convierte el `NULL` en 0).
- Cada tabla se **cuenta antes del join**. Si se unieran las dos tablas de registro directo, cada visita de masaje
  se repetiría por cada visita de recuperación y los conteos saldrían multiplicados.

### `vw_visitas`: todas las visitas juntas

`UNION ALL` de las dos tablas de registro con una columna `actividad`. La usan las estadísticas por día y por hora.

## Procedimiento almacenado `sp_estadisticas`

```sql
CALL sp_estadisticas(p_accion, p_limite);
```

| `p_accion` | Qué regresa |
|------------|-------------|
| `RESUMEN` | Una fila con totales y porcentajes generales |
| `USUARIOS` | Los 200 usuarios con veces por actividad, total y actividad favorita |
| `TOP` | Quién fue más a cada actividad; `p_limite` = lugares (5 por defecto). Usa **INNER JOIN** (solo quien sí fue) y `RANK()` (los empates comparten lugar) |
| `POR_DIA` | Visitas por día (martes / jueves) y actividad |
| `POR_HORA` | Visitas por hora y actividad |
| `POR_AREA` | Visitas y porcentaje de asistencia por área |

Truco usado en los conteos: en MySQL una condición vale `1` o `0`, así que `SUM(veces_masajes > 0)` cuenta cuántos usuarios fueron a masajes.

### Columnas de `RESUMEN`

| Columna | Significado |
|---------|-------------|
| `usuarios_masajes`, `usuarios_recuperacion` | Personas que fueron al menos una vez a cada actividad |
| `usuarios_ambas` / `usuarios_ninguna` | Fueron a las dos / no fueron a ninguna |
| `pct_usuarios_masajes`, `pct_usuarios_recuperacion`, `pct_usuarios_ambas` | Lo anterior como porcentaje de los 200 |
| `pct_asistencia_total` | Porcentaje de los 200 que fue al menos a una actividad |
| `visitas_masajes`, `visitas_recuperacion`, `total_visitas` | Número de visitas |
| `pct_visitas_masajes`, `pct_visitas_recuperacion` | Reparto de las visitas entre las dos actividades (suman 100%) |

## Pruebas

```sql
CALL sp_estadisticas('RESUMEN', NULL);
-- total_usuarios 200, usuarios_masajes 153, usuarios_recuperacion 139,
-- usuarios_ambas 106, usuarios_ninguna 14, total_visitas 1345 (719 + 626),
-- pct_asistencia_total 93.00

CALL sp_estadisticas('TOP', 3);

-- El trigger debe rechazar esto (2026-06-01 es lunes):
INSERT INTO registro_masajes (id_usuario, fecha, hora) VALUES (1, '2026-06-01', '10:00');
```

## Cómo correr el proyecto

1. Cargar el script en MySQL (desde la carpeta `SofttekAmenidades`):
   ```
   mysql -u root -p --default-character-set=utf8mb4 < database/softtek_amenidades.sql
   ```
2. Ajustar usuario y contraseña en [server/index.js](server/index.js).
3. Instalar dependencias: `npm install`
4. En una terminal: `npm run server` (API en el puerto 3002)
5. En otra terminal: `npm run dev` y abrir la dirección que muestre Vite

## Arquitectura

```
React (Vite)  --fetch /api-->  Express (server/index.js)  --CALL sp_estadisticas-->  MySQL
```

| Ruta | Acción |
|------|--------|
| `GET /api/resumen` | `RESUMEN` |
| `GET /api/usuarios` | `USUARIOS` |
| `GET /api/top?limite=5` | `TOP` |
| `GET /api/por-dia` | `POR_DIA` |
| `GET /api/por-hora` | `POR_HORA` |
| `GET /api/por-area` | `POR_AREA` |
