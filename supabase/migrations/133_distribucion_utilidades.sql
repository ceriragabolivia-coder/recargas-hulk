-- Migration: 133_distribucion_utilidades.sql
-- Description: Sistema de aportes de capital por socios y distribución periódica de utilidades.
-- Ver PLAN_DISTRIBUCION_UTILIDADES.md en la raíz del repo para el detalle de negocio.
--
-- Diseño: dos libros independientes por socio.
--   1) CAPITAL (socios_capital / socios_capital_historial): aporte_capital (+) / retiro_capital (-).
--      Define el % de participación vigente de cada socio.
--   2) UTILIDAD (socios_utilidad / socios_utilidad_historial): utilidad_asignada (+) / retiro_utilidad (-).
--      Saldo a pagar; cobrar utilidad NO afecta el capital ni el % futuro.
--
-- La ganancia a repartir = SUM(ventas.ganancia_usd) de ventas con owner_id IS NULL (negocio principal,
-- no tenants "negocio") en el rango de fechas, que aún no hayan sido marcadas como distribuidas.
-- El capital se aporta/trackea en USD; la utilidad se distribuye y paga en Bs (tasa congelada por reparto).

-- ============================================================
-- 0. Permitir el rol 'socio' en perfiles
-- ============================================================
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE public.perfiles
ADD CONSTRAINT perfiles_rol_check
CHECK (rol IN ('admin', 'administrador', 'cliente', 'revendedor', 'negocio', 'empleado', 'trabajador', 'socio'));

-- ============================================================
-- 1. socios_capital — saldo de capital vigente (neto) por socio
-- ============================================================
CREATE TABLE IF NOT EXISTS public.socios_capital (
    auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    capital_aportado_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.socios_capital ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "socios_capital_admin_all" ON public.socios_capital;
CREATE POLICY "socios_capital_admin_all" ON public.socios_capital
    FOR ALL TO authenticated USING (
        public.is_superadmin()
        OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador'))
    );

DROP POLICY IF EXISTS "socios_capital_self_select" ON public.socios_capital;
CREATE POLICY "socios_capital_self_select" ON public.socios_capital
    FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

-- ============================================================
-- 2. socios_capital_historial — libro de movimientos de CAPITAL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.socios_capital_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    socio_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('aporte_capital', 'retiro_capital')),
    monto_usd NUMERIC(14,2) NOT NULL,
    notas TEXT,
    registrado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.socios_capital_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "socios_capital_historial_admin_all" ON public.socios_capital_historial;
CREATE POLICY "socios_capital_historial_admin_all" ON public.socios_capital_historial
    FOR ALL TO authenticated USING (
        public.is_superadmin()
        OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador'))
    );

DROP POLICY IF EXISTS "socios_capital_historial_self_select" ON public.socios_capital_historial;
CREATE POLICY "socios_capital_historial_self_select" ON public.socios_capital_historial
    FOR SELECT TO authenticated USING (socio_id = auth.uid());

-- ============================================================
-- 3. socios_utilidad — saldo de UTILIDAD vigente por socio (separado del capital)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.socios_utilidad (
    auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    saldo_utilidad_bs NUMERIC(16,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.socios_utilidad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "socios_utilidad_admin_all" ON public.socios_utilidad;
CREATE POLICY "socios_utilidad_admin_all" ON public.socios_utilidad
    FOR ALL TO authenticated USING (
        public.is_superadmin()
        OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador'))
    );

DROP POLICY IF EXISTS "socios_utilidad_self_select" ON public.socios_utilidad;
CREATE POLICY "socios_utilidad_self_select" ON public.socios_utilidad
    FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

-- ============================================================
-- 4. distribuciones_utilidad — cabecera de cada reparto ejecutado
-- ============================================================
CREATE TABLE IF NOT EXISTS public.distribuciones_utilidad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_desde DATE NOT NULL,
    fecha_hasta DATE NOT NULL,
    ganancia_total_usd NUMERIC(14,2) NOT NULL,
    tasa_dolar_usada NUMERIC(10,4) NOT NULL,
    ganancia_total_bs NUMERIC(16,2) NOT NULL,
    capital_total_usd NUMERIC(14,2) NOT NULL,
    ejecutado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.distribuciones_utilidad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "distribuciones_utilidad_admin_all" ON public.distribuciones_utilidad;
CREATE POLICY "distribuciones_utilidad_admin_all" ON public.distribuciones_utilidad
    FOR ALL TO authenticated USING (
        public.is_superadmin()
        OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador'))
    );

-- Nota: la policy "self_select" (lectura del propio socio) se crea más abajo,
-- después de la tabla distribuciones_utilidad_detalle, porque depende de ella.

-- ============================================================
-- 5. distribuciones_utilidad_detalle — monto por socio en cada reparto
-- ============================================================
CREATE TABLE IF NOT EXISTS public.distribuciones_utilidad_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribucion_id UUID NOT NULL REFERENCES public.distribuciones_utilidad(id) ON DELETE CASCADE,
    socio_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    capital_usd_en_momento NUMERIC(14,2) NOT NULL,
    porcentaje NUMERIC(7,4) NOT NULL,
    monto_bs NUMERIC(16,2) NOT NULL,
    monto_usd_informativo NUMERIC(14,2) NOT NULL
);

ALTER TABLE public.distribuciones_utilidad_detalle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "distribuciones_utilidad_detalle_admin_all" ON public.distribuciones_utilidad_detalle;
CREATE POLICY "distribuciones_utilidad_detalle_admin_all" ON public.distribuciones_utilidad_detalle
    FOR ALL TO authenticated USING (
        public.is_superadmin()
        OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador'))
    );

DROP POLICY IF EXISTS "distribuciones_utilidad_detalle_self_select" ON public.distribuciones_utilidad_detalle;
CREATE POLICY "distribuciones_utilidad_detalle_self_select" ON public.distribuciones_utilidad_detalle
    FOR SELECT TO authenticated USING (socio_id = auth.uid());

DROP POLICY IF EXISTS "distribuciones_utilidad_self_select" ON public.distribuciones_utilidad;
CREATE POLICY "distribuciones_utilidad_self_select" ON public.distribuciones_utilidad
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.distribuciones_utilidad_detalle d
            WHERE d.distribucion_id = distribuciones_utilidad.id AND d.socio_id = auth.uid()
        )
    );

-- ============================================================
-- 6. socios_utilidad_historial — libro de movimientos de UTILIDAD
-- ============================================================
CREATE TABLE IF NOT EXISTS public.socios_utilidad_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    socio_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    distribucion_id UUID REFERENCES public.distribuciones_utilidad(id) ON DELETE SET NULL,
    tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('utilidad_asignada', 'retiro_utilidad')),
    monto_bs NUMERIC(16,2) NOT NULL,
    notas TEXT,
    registrado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.socios_utilidad_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "socios_utilidad_historial_admin_all" ON public.socios_utilidad_historial;
CREATE POLICY "socios_utilidad_historial_admin_all" ON public.socios_utilidad_historial
    FOR ALL TO authenticated USING (
        public.is_superadmin()
        OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador'))
    );

DROP POLICY IF EXISTS "socios_utilidad_historial_self_select" ON public.socios_utilidad_historial;
CREATE POLICY "socios_utilidad_historial_self_select" ON public.socios_utilidad_historial
    FOR SELECT TO authenticated USING (socio_id = auth.uid());

-- ============================================================
-- 7. ventas — columna de control para evitar repartir dos veces la misma ganancia
-- ============================================================
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS distribuida_en_id UUID REFERENCES public.distribuciones_utilidad(id);

CREATE INDEX IF NOT EXISTS idx_ventas_no_distribuidas ON public.ventas (created_at) WHERE distribuida_en_id IS NULL;

-- ============================================================
-- 8. RPC: registrar_aporte_capital_rpc
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_aporte_capital_rpc(
    p_socio_id UUID,
    p_monto_usd NUMERIC,
    p_notas TEXT DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
    IF NOT (public.is_superadmin() OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador'))) THEN
        RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos para registrar aportes de capital');
    END IF;

    IF p_monto_usd IS NULL OR p_monto_usd <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El monto debe ser mayor a cero');
    END IF;

    INSERT INTO public.socios_capital (auth_user_id, capital_aportado_usd)
    VALUES (p_socio_id, p_monto_usd)
    ON CONFLICT (auth_user_id)
    DO UPDATE SET capital_aportado_usd = public.socios_capital.capital_aportado_usd + p_monto_usd, updated_at = now();

    INSERT INTO public.socios_capital_historial (socio_id, tipo_movimiento, monto_usd, notas, registrado_por_id)
    VALUES (p_socio_id, 'aporte_capital', p_monto_usd, p_notas, auth.uid());

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. RPC: registrar_retiro_capital_rpc
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_retiro_capital_rpc(
    p_socio_id UUID,
    p_monto_usd NUMERIC,
    p_notas TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_capital_actual NUMERIC;
BEGIN
    IF NOT (public.is_superadmin() OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador'))) THEN
        RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos para registrar retiros de capital');
    END IF;

    IF p_monto_usd IS NULL OR p_monto_usd <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El monto debe ser mayor a cero');
    END IF;

    SELECT capital_aportado_usd INTO v_capital_actual FROM public.socios_capital WHERE auth_user_id = p_socio_id FOR UPDATE;

    IF v_capital_actual IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'El socio no tiene capital aportado registrado');
    END IF;

    IF v_capital_actual < p_monto_usd THEN
        RETURN jsonb_build_object('success', false, 'error', 'Capital insuficiente para este retiro (capital actual: ' || v_capital_actual || ')');
    END IF;

    UPDATE public.socios_capital SET capital_aportado_usd = capital_aportado_usd - p_monto_usd, updated_at = now() WHERE auth_user_id = p_socio_id;

    INSERT INTO public.socios_capital_historial (socio_id, tipo_movimiento, monto_usd, notas, registrado_por_id)
    VALUES (p_socio_id, 'retiro_capital', p_monto_usd, p_notas, auth.uid());

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. RPC: calcular_distribucion_utilidad_rpc (solo cálculo / preview, no escribe nada)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calcular_distribucion_utilidad_rpc(
    p_fecha_desde DATE,
    p_fecha_hasta DATE
) RETURNS JSONB AS $$
DECLARE
    v_ganancia_total_usd NUMERIC;
    v_capital_total_usd NUMERIC;
    v_tasa_dolar NUMERIC;
    v_detalle JSONB;
BEGIN
    IF NOT (public.is_superadmin() OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador'))) THEN
        RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos para calcular distribuciones de utilidad');
    END IF;

    SELECT COALESCE(SUM(ganancia_usd), 0) INTO v_ganancia_total_usd
    FROM public.ventas
    WHERE owner_id IS NULL
      AND distribuida_en_id IS NULL
      AND created_at >= p_fecha_desde::timestamptz
      AND created_at < (p_fecha_hasta + INTERVAL '1 day')::timestamptz;

    SELECT COALESCE(SUM(capital_aportado_usd), 0) INTO v_capital_total_usd
    FROM public.socios_capital
    WHERE capital_aportado_usd > 0;

    SELECT valor INTO v_tasa_dolar FROM public.configuracion WHERE clave = 'tasa_dolar' AND owner_id IS NULL;

    IF v_tasa_dolar IS NULL OR v_tasa_dolar <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No se encontró una tasa del dólar válida en configuración');
    END IF;

    IF v_ganancia_total_usd <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay ganancia pendiente por distribuir en ese rango de fechas');
    END IF;

    IF v_capital_total_usd <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay socios con capital aportado registrado');
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'socio_id', sc.auth_user_id,
        'capital_usd', sc.capital_aportado_usd,
        'porcentaje', ROUND((sc.capital_aportado_usd / v_capital_total_usd) * 100, 4),
        'monto_bs', ROUND((sc.capital_aportado_usd / v_capital_total_usd) * v_ganancia_total_usd * v_tasa_dolar, 2),
        'monto_usd_informativo', ROUND((sc.capital_aportado_usd / v_capital_total_usd) * v_ganancia_total_usd, 2)
    )), '[]'::jsonb) INTO v_detalle
    FROM public.socios_capital sc
    WHERE sc.capital_aportado_usd > 0;

    RETURN jsonb_build_object(
        'success', true,
        'fecha_desde', p_fecha_desde,
        'fecha_hasta', p_fecha_hasta,
        'ganancia_total_usd', v_ganancia_total_usd,
        'tasa_dolar_usada', v_tasa_dolar,
        'ganancia_total_bs', ROUND(v_ganancia_total_usd * v_tasa_dolar, 2),
        'capital_total_usd', v_capital_total_usd,
        'detalle', v_detalle
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 11. RPC: ejecutar_distribucion_utilidad_rpc (escribe y marca ventas como distribuidas)
-- ============================================================
CREATE OR REPLACE FUNCTION public.ejecutar_distribucion_utilidad_rpc(
    p_fecha_desde DATE,
    p_fecha_hasta DATE
) RETURNS JSONB AS $$
DECLARE
    v_ganancia_total_usd NUMERIC;
    v_capital_total_usd NUMERIC;
    v_tasa_dolar NUMERIC;
    v_ganancia_total_bs NUMERIC;
    v_distribucion_id UUID;
    v_socio RECORD;
    v_monto_bs NUMERIC;
    v_monto_usd NUMERIC;
    v_porcentaje NUMERIC;
BEGIN
    IF NOT (public.is_superadmin() OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador'))) THEN
        RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos para ejecutar distribuciones de utilidad');
    END IF;

    -- Nota: no se usa FOR UPDATE aquí porque Postgres no lo permite junto a SUM().
    -- El UPDATE final sobre ventas (marcando distribuida_en_id) y los upserts por socio
    -- son las operaciones que efectivamente bloquean fila a fila al escribir.
    SELECT COALESCE(SUM(ganancia_usd), 0) INTO v_ganancia_total_usd
    FROM public.ventas
    WHERE owner_id IS NULL
      AND distribuida_en_id IS NULL
      AND created_at >= p_fecha_desde::timestamptz
      AND created_at < (p_fecha_hasta + INTERVAL '1 day')::timestamptz;

    SELECT COALESCE(SUM(capital_aportado_usd), 0) INTO v_capital_total_usd
    FROM public.socios_capital
    WHERE capital_aportado_usd > 0;

    SELECT valor INTO v_tasa_dolar FROM public.configuracion WHERE clave = 'tasa_dolar' AND owner_id IS NULL;

    IF v_tasa_dolar IS NULL OR v_tasa_dolar <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No se encontró una tasa del dólar válida en configuración');
    END IF;

    IF v_ganancia_total_usd <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay ganancia pendiente por distribuir en ese rango de fechas');
    END IF;

    IF v_capital_total_usd <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay socios con capital aportado registrado');
    END IF;

    v_ganancia_total_bs := ROUND(v_ganancia_total_usd * v_tasa_dolar, 2);

    INSERT INTO public.distribuciones_utilidad (
        fecha_desde, fecha_hasta, ganancia_total_usd, tasa_dolar_usada, ganancia_total_bs, capital_total_usd, ejecutado_por_id
    ) VALUES (
        p_fecha_desde, p_fecha_hasta, v_ganancia_total_usd, v_tasa_dolar, v_ganancia_total_bs, v_capital_total_usd, auth.uid()
    ) RETURNING id INTO v_distribucion_id;

    FOR v_socio IN
        SELECT auth_user_id, capital_aportado_usd FROM public.socios_capital WHERE capital_aportado_usd > 0
    LOOP
        v_porcentaje := ROUND((v_socio.capital_aportado_usd / v_capital_total_usd) * 100, 4);
        v_monto_bs := ROUND((v_socio.capital_aportado_usd / v_capital_total_usd) * v_ganancia_total_bs, 2);
        v_monto_usd := ROUND((v_socio.capital_aportado_usd / v_capital_total_usd) * v_ganancia_total_usd, 2);

        INSERT INTO public.distribuciones_utilidad_detalle (
            distribucion_id, socio_id, capital_usd_en_momento, porcentaje, monto_bs, monto_usd_informativo
        ) VALUES (
            v_distribucion_id, v_socio.auth_user_id, v_socio.capital_aportado_usd, v_porcentaje, v_monto_bs, v_monto_usd
        );

        INSERT INTO public.socios_utilidad (auth_user_id, saldo_utilidad_bs)
        VALUES (v_socio.auth_user_id, v_monto_bs)
        ON CONFLICT (auth_user_id)
        DO UPDATE SET saldo_utilidad_bs = public.socios_utilidad.saldo_utilidad_bs + v_monto_bs, updated_at = now();

        INSERT INTO public.socios_utilidad_historial (socio_id, distribucion_id, tipo_movimiento, monto_bs, notas, registrado_por_id)
        VALUES (v_socio.auth_user_id, v_distribucion_id, 'utilidad_asignada', v_monto_bs, 'Distribución ' || p_fecha_desde || ' a ' || p_fecha_hasta, auth.uid());
    END LOOP;

    UPDATE public.ventas
    SET distribuida_en_id = v_distribucion_id
    WHERE owner_id IS NULL
      AND distribuida_en_id IS NULL
      AND created_at >= p_fecha_desde::timestamptz
      AND created_at < (p_fecha_hasta + INTERVAL '1 day')::timestamptz;

    RETURN jsonb_build_object(
        'success', true,
        'distribucion_id', v_distribucion_id,
        'ganancia_total_usd', v_ganancia_total_usd,
        'ganancia_total_bs', v_ganancia_total_bs,
        'tasa_dolar_usada', v_tasa_dolar,
        'capital_total_usd', v_capital_total_usd
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 12. RPC: pagar_utilidad_socio_rpc
-- ============================================================
CREATE OR REPLACE FUNCTION public.pagar_utilidad_socio_rpc(
    p_socio_id UUID,
    p_monto_bs NUMERIC,
    p_notas TEXT DEFAULT 'Pago de utilidad a socio'
) RETURNS JSONB AS $$
DECLARE
    v_saldo_actual NUMERIC;
BEGIN
    IF NOT (public.is_superadmin() OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador'))) THEN
        RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos para registrar pagos de utilidad');
    END IF;

    IF p_monto_bs IS NULL OR p_monto_bs <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El monto debe ser mayor a cero');
    END IF;

    SELECT saldo_utilidad_bs INTO v_saldo_actual FROM public.socios_utilidad WHERE auth_user_id = p_socio_id FOR UPDATE;

    IF v_saldo_actual IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'El socio no tiene saldo de utilidad registrado');
    END IF;

    IF v_saldo_actual < p_monto_bs THEN
        RETURN jsonb_build_object('success', false, 'error', 'Saldo de utilidad insuficiente (saldo actual: ' || v_saldo_actual || ' Bs)');
    END IF;

    UPDATE public.socios_utilidad SET saldo_utilidad_bs = saldo_utilidad_bs - p_monto_bs, updated_at = now() WHERE auth_user_id = p_socio_id;

    INSERT INTO public.socios_utilidad_historial (socio_id, tipo_movimiento, monto_bs, notas, registrado_por_id)
    VALUES (p_socio_id, 'retiro_utilidad', p_monto_bs, p_notas, auth.uid());

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 13. Recargar caché de PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
