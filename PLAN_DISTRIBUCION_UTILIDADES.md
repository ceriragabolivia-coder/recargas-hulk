# Plan: Distribución de Utilidades por Aporte de Capital (Socios)

## 1. Resumen del problema

Hoy el sistema no tiene ningún concepto de "socio que aporta capital". Lo que existe es:

- `ventas.ganancia_usd` — margen de cada venta (ya usado por `Reportes.jsx` para calcular "Ganancia Neta del Periodo").
- `admin_saldos` / `admin_saldos_historial` / `liquidar_saldo_admin_rpc` — saldo que se acredita a un **admin** por las ventas que él mismo **atendió** (`atendido_por_id`), liquidable manualmente. Esto es una comisión operativa, no una participación de capital.
- El saldo prepago de la API del proveedor (TiendaGiftVen, vía `/api/v1/saldo`) es un **único monto compartido** — la API no sabe ni le importa quién metió cuánto dinero para fondearlo.

Lo que se necesita: varios **socios** recargan ese saldo compartido de la API con su propio dinero. Cuando el negocio genera utilidades (ganancia de ventas), esas utilidades se deben repartir entre los socios **proporcionalmente a cuánto capital tiene aportado cada uno en ese momento** — y ese reparto de utilidad debe administrarse, registrarse y poder pagarse, sin mezclarse nunca con el capital aportado.

## 2. Reglas de negocio confirmadas

1. **Capital y utilidad son dos libros completamente separados** por socio:
   - **Capital aportado** (`aporte_capital` +, `retiro_capital` −): define el % de participación de cada socio. Un retiro de capital sí reduce ese % a futuro.
   - **Utilidad asignada** (crédito por cada distribución, `retiro_utilidad` −): es un saldo aparte que se le debe pagar al socio. Cobrar utilidad **no** afecta su capital aportado ni su % futuro.
2. El % de cada socio en un reparto se calcula sobre su **aporte neto vigente** (`total aportado − total retirado` de capital) **al momento de ejecutar la distribución** — no se reconstruye el aporte histórico que tenía en la fecha exacta de cada venta.
3. La utilidad a repartir en un período = `SUM(ventas.ganancia_usd)` de las ventas completadas en el rango de fechas elegido (mismo cálculo que ya usa `Reportes.jsx`). No se restan gastos operativos — eso queda fuera de alcance.
4. El reparto es **manual y a demanda**: un admin entra a una pantalla nueva, elige un rango de fechas, el sistema muestra el cálculo (utilidad total, % y monto por socio) y el admin confirma para ejecutarlo.
5. **Moneda**: el capital se aporta y se trackea en **USD**. La utilidad distribuida se calcula y se acredita en **Bolívares**, convertida con la `tasa_dolar` vigente en `configuracion` al momento del reparto. El equivalente en USD de la utilidad se muestra solo como dato informativo (no es la unidad real del saldo de utilidad).
6. Para evitar repartir dos veces la misma ganancia: cada venta queda **marcada con el id de la distribución** que la consumió (`distribuida_en_id` o similar). Cualquier cálculo futuro de utilidad solo toma ventas con ese campo `NULL`, sin importar si el rango de fechas se solapa con un reparto anterior.
7. **Roles y acceso**:
   - Nuevo rol `socio` en `perfiles.rol`.
   - El **admin** gestiona todo: registra aportes/retiros de capital, ejecuta distribuciones, ve todos los socios y el historial completo.
   - El **socio** tiene una vista de solo lectura de **sus propios** datos: su capital vigente, su % actual, su historial de aportes/retiros, y su saldo/historial de utilidad (asignaciones y pagos).

## 3. Modelo de datos (nueva migración SQL)

Nuevo archivo: `supabase/migrations/133_distribucion_utilidades.sql`. Se diseña siguiendo el mismo patrón ya usado en `052_pagos_admins.sql` (tabla de saldo + tabla de historial + RPCs `SECURITY DEFINER` + RLS).

### 3.1 `socios_capital` (saldo de capital vigente, uno por socio)
```sql
CREATE TABLE public.socios_capital (
    auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    capital_aportado_usd NUMERIC(14,2) NOT NULL DEFAULT 0,  -- neto: aportes - retiros de capital
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 `socios_capital_historial` (libro de movimientos de CAPITAL)
```sql
CREATE TABLE public.socios_capital_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    socio_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('aporte_capital', 'retiro_capital')),
    monto_usd NUMERIC(14,2) NOT NULL,
    notas TEXT,
    registrado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 `distribuciones_utilidad` (cabecera de cada reparto ejecutado)
```sql
CREATE TABLE public.distribuciones_utilidad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_desde DATE NOT NULL,
    fecha_hasta DATE NOT NULL,
    ganancia_total_usd NUMERIC(14,2) NOT NULL,       -- SUM(ventas.ganancia_usd) del rango, informativo
    tasa_dolar_usada NUMERIC(10,4) NOT NULL,          -- tasa vigente al momento del reparto
    ganancia_total_bs NUMERIC(16,2) NOT NULL,         -- ganancia_total_usd * tasa_dolar_usada (lo que realmente se reparte)
    capital_total_usd NUMERIC(14,2) NOT NULL,         -- suma de capital neto vigente de todos los socios en ese momento
    ejecutado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.4 `distribuciones_utilidad_detalle` (cuánto le tocó a cada socio en esa distribución)
```sql
CREATE TABLE public.distribuciones_utilidad_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribucion_id UUID NOT NULL REFERENCES public.distribuciones_utilidad(id) ON DELETE CASCADE,
    socio_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    capital_usd_en_momento NUMERIC(14,2) NOT NULL,    -- snapshot de su capital vigente al calcular
    porcentaje NUMERIC(7,4) NOT NULL,                  -- snapshot de su % (capital_usd_en_momento / capital_total_usd)
    monto_bs NUMERIC(16,2) NOT NULL,                   -- lo que le corresponde, en Bs
    monto_usd_informativo NUMERIC(14,2) NOT NULL       -- equivalente en USD, solo informativo
);
```

### 3.5 `socios_utilidad` (saldo de UTILIDAD vigente, uno por socio — separado del capital)
```sql
CREATE TABLE public.socios_utilidad (
    auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    saldo_utilidad_bs NUMERIC(16,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.6 `socios_utilidad_historial` (libro de movimientos de UTILIDAD)
```sql
CREATE TABLE public.socios_utilidad_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    socio_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    distribucion_id UUID REFERENCES public.distribuciones_utilidad(id) ON DELETE SET NULL,
    tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('utilidad_asignada', 'retiro_utilidad')),
    monto_bs NUMERIC(16,2) NOT NULL,
    notas TEXT,
    registrado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.7 Cambio sobre `ventas`
```sql
ALTER TABLE public.ventas ADD COLUMN distribuida_en_id UUID REFERENCES public.distribuciones_utilidad(id);
```
Índice parcial recomendado para que el cálculo de "ventas no distribuidas" sea rápido:
```sql
CREATE INDEX idx_ventas_no_distribuidas ON public.ventas (estado) WHERE distribuida_en_id IS NULL;
```

### 3.8 RLS
- `socios_capital`, `socios_capital_historial`, `socios_utilidad`, `socios_utilidad_historial`: admin ve todo; el propio socio (`auth_user_id = auth.uid()` / `socio_id = auth.uid()`) solo ve sus propias filas (`SELECT`, sin `INSERT/UPDATE/DELETE` directo — todo movimiento pasa por RPC `SECURITY DEFINER`).
- `distribuciones_utilidad` / `_detalle`: admin ve todo; socio solo ve las filas de detalle donde `socio_id = auth.uid()` (más la cabecera correspondiente vía join o una vista).

## 4. RPCs necesarias (`SECURITY DEFINER`, solo admin)

1. **`registrar_aporte_capital_rpc(p_socio_id, p_monto_usd, p_notas)`**
   Inserta en `socios_capital_historial` (`aporte_capital`) y hace upsert sumando en `socios_capital`.

2. **`registrar_retiro_capital_rpc(p_socio_id, p_monto_usd, p_notas)`**
   Valida que `capital_aportado_usd >= p_monto_usd`; inserta `retiro_capital` y resta del saldo. Si no hay capital suficiente, retorna error (igual patrón que `liquidar_saldo_admin_rpc`).

3. **`calcular_distribucion_utilidad_rpc(p_fecha_desde, p_fecha_hasta)`** (solo cálculo, no ejecuta nada — para que el admin "previsualice" antes de confirmar)
   - Calcula `ganancia_total_usd = SUM(ventas.ganancia_usd)` donde `estado = 'completado' AND distribuida_en_id IS NULL` y la fecha de la venta cae en el rango.
   - Trae `capital_total_usd = SUM(socios_capital.capital_aportado_usd)`.
   - Devuelve, por cada socio con capital > 0: su `%` y el monto en Bs que le tocaría (usando la tasa vigente), sin escribir nada en la base.

4. **`ejecutar_distribucion_utilidad_rpc(p_fecha_desde, p_fecha_hasta)`**
   - Repite el cálculo anterior dentro de una transacción.
   - Si `ganancia_total_usd <= 0` o no hay capital total > 0, retorna error (nada que repartir).
   - Inserta la cabecera en `distribuciones_utilidad`.
   - Por cada socio con capital > 0: inserta su fila en `distribuciones_utilidad_detalle`, hace upsert sumando en `socios_utilidad.saldo_utilidad_bs`, e inserta `utilidad_asignada` en `socios_utilidad_historial`.
   - Marca **todas** las ventas usadas (`distribuida_en_id = <id de la distribución>`).
   - Retorna el resumen ejecutado.

5. **`pagar_utilidad_socio_rpc(p_socio_id, p_monto_bs, p_notas)`**
   Mismo patrón que `liquidar_saldo_admin_rpc`: valida saldo suficiente en `socios_utilidad`, lo descuenta, e inserta `retiro_utilidad` en `socios_utilidad_historial`. El pago real (Zelle, transferencia, efectivo) ocurre fuera del sistema; esto solo registra que ya se pagó.

## 5. UI / Frontend

### 5.1 Pantalla admin: `GestionSocios.jsx` (nueva, ruta `/Gestion-Socios`, solo admin)
Tres pestañas, mismo estilo que `PagosAdmins.jsx`:
- **Socios y capital**: tabla de socios con su capital vigente y % actual, botón para "Registrar aporte" / "Registrar retiro" (abre modal, llama las RPCs 1/2).
- **Distribuir utilidad**: selector de rango de fechas → botón "Calcular" (RPC 3, muestra preview en tabla: socio, %, monto Bs/USD) → botón "Confirmar y ejecutar" (RPC 4) con modal de confirmación (acción irreversible, similar a las confirmaciones que ya usa `AlertModal`).
- **Pagos de utilidad**: tabla de socios con su `saldo_utilidad_bs` pendiente, botón "Registrar pago" (RPC 5) + historial combinado de `socios_capital_historial` y `socios_utilidad_historial`.

### 5.2 Vista self-service del socio
Una sección nueva (puede ir dentro de `Perfil.jsx` o una ruta propia `/Mi-Participacion`, gateada por `perfil.rol === 'socio'`) que muestra, solo lectura:
- Su capital aportado vigente y su % actual (calculado contra el capital total en ese momento).
- Historial de sus aportes/retiros de capital.
- Su saldo de utilidad pendiente y el historial de utilidades asignadas/pagadas.

### 5.3 Cambios en `App.jsx`
- Agregar `isSocio = perfil?.rol?.toLowerCase() === 'socio'`.
- Ruta `/Gestion-Socios` gateada a `isAdmin`.
- Ruta `/Mi-Participacion` (o sección dentro de Perfil) accesible para `isSocio`.
- Entrada de menú en `Layout.jsx` para ambos casos.

## 6. Casos borde a manejar

- **Ganancia negativa en el período** (más reembolsos que ventas netas): la RPC de ejecución debe rechazar o, si se decide permitirlo más adelante, definir cómo se "reparte" una pérdida — **fuera de alcance de la v1**, simplemente bloquear con mensaje claro.
- **Socio sin capital (0)**: no aparece en el detalle de la distribución (división por cero evitada).
- **Reembolso de una venta ya distribuida**: como la venta ya quedó marcada (`distribuida_en_id` no nulo), no se puede "revertir" automáticamente la utilidad ya repartida — debe quedar documentado como limitación conocida (ajuste manual si ocurre).
- **Tasa de cambio**: cada distribución congela la tasa usada (`tasa_dolar_usada`) en su propia fila, para que el historial sea auditable aunque la tasa cambie después.
- **Concurrencia**: usar `FOR UPDATE` al leer `socios_capital`/`socios_utilidad` dentro de las RPCs de escritura, igual que ya hace `liquidar_saldo_admin_rpc`.

## 7. Fases de implementación sugeridas

1. **Migración SQL** (sección 3 completa) + RPCs (sección 4) + pruebas manuales vía SQL editor de Supabase con datos de prueba.
2. **Pantalla admin `GestionSocios.jsx`**: gestión de capital (aportes/retiros) primero, sin distribución todavía.
3. **Flujo de cálculo + ejecución de distribución** (preview y confirmación) dentro de la misma pantalla.
4. **Pestaña de pagos de utilidad** + historial combinado.
5. **Vista self-service del socio** + ruteo/menú condicional por rol.
6. Pruebas end-to-end: crear socio de prueba, aportar capital, generar ventas, calcular y ejecutar distribución, verificar que las ventas quedaron marcadas y que un segundo cálculo en el mismo rango da $0 disponible para repartir.

## 8. Fuera de alcance (v1)

- Descontar gastos operativos de la utilidad antes de repartir.
- Reconstrucción histórica del % de cada socio en la fecha exacta de cada venta (se usa capital vigente al momento del reparto).
- Reparto automático/programado.
- Manejo de pérdidas (ganancia negativa) en un período.
