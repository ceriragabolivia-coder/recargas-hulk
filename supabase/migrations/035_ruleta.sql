-- ============================================================
-- Migración 035: Sistema de Ruleta de Premios
-- ============================================================

-- 1. Premios configurables por el admin
CREATE TABLE IF NOT EXISTS public.ruleta_premios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  tipo text NOT NULL DEFAULT 'mensaje', -- 'saldo_usd' | 'saldo_bs' | 'mensaje' | 'sin_premio'
  valor numeric DEFAULT 0,
  probabilidad integer NOT NULL DEFAULT 10, -- peso relativo (1-100)
  color text NOT NULL DEFAULT '#6366f1',
  emoji text DEFAULT '🎁',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Historial de giros realizados
CREATE TABLE IF NOT EXISTS public.ruleta_giros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES auth.users(id),
  premio_id uuid REFERENCES public.ruleta_premios(id),
  premio_nombre text NOT NULL,
  tipo text NOT NULL,
  valor numeric DEFAULT 0,
  acreditado boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. Giros disponibles por usuario (acumulables)
CREATE TABLE IF NOT EXISTS public.ruleta_giros_disponibles (
  cliente_id uuid PRIMARY KEY REFERENCES auth.users(id),
  giros_disponibles integer NOT NULL DEFAULT 0,
  total_ganados integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- 4. Config de la ruleta en tabla de configuración existente
ALTER TABLE public.configuracion
  ADD COLUMN IF NOT EXISTS ruleta_activa text DEFAULT 'true',
  ADD COLUMN IF NOT EXISTS ruleta_titulo text DEFAULT '¡Gira y Gana!',
  ADD COLUMN IF NOT EXISTS ruleta_descripcion text DEFAULT 'Cada pedido completado te da un giro. ¡Prueba tu suerte!';

-- 5. RLS
ALTER TABLE public.ruleta_premios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ruleta_giros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ruleta_giros_disponibles ENABLE ROW LEVEL SECURITY;

-- Premios: todos los autenticados pueden leer los activos
DROP POLICY IF EXISTS "premios_select_activos" ON public.ruleta_premios;
CREATE POLICY "premios_select_activos" ON public.ruleta_premios
  FOR SELECT USING (activo = true);

-- Premios: solo admins pueden modificar
DROP POLICY IF EXISTS "premios_admin_all" ON public.ruleta_premios;
CREATE POLICY "premios_admin_all" ON public.ruleta_premios
  FOR ALL USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Giros historial: usuario ve los suyos
DROP POLICY IF EXISTS "giros_select_own" ON public.ruleta_giros;
CREATE POLICY "giros_select_own" ON public.ruleta_giros
  FOR SELECT USING (cliente_id = auth.uid());

-- Giros historial: admin ve todos
DROP POLICY IF EXISTS "giros_select_admin" ON public.ruleta_giros;
CREATE POLICY "giros_select_admin" ON public.ruleta_giros
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Giros disponibles: usuario ve los suyos
DROP POLICY IF EXISTS "giros_disp_select_own" ON public.ruleta_giros_disponibles;
CREATE POLICY "giros_disp_select_own" ON public.ruleta_giros_disponibles
  FOR SELECT USING (cliente_id = auth.uid());

-- Giros disponibles: admin ve y modifica todos
DROP POLICY IF EXISTS "giros_disp_admin_all" ON public.ruleta_giros_disponibles;
CREATE POLICY "giros_disp_admin_all" ON public.ruleta_giros_disponibles
  FOR ALL USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- ============================================================
-- 6. Trigger: auto-asignar 1 giro cuando pedido → completado
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_asignar_giro_por_pedido()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Solo cuando el estado cambia A 'completado' y el cliente existe
  IF NEW.estado = 'completado' AND (OLD.estado IS DISTINCT FROM 'completado') AND NEW.cliente_id IS NOT NULL THEN
    INSERT INTO public.ruleta_giros_disponibles (cliente_id, giros_disponibles, total_ganados)
    VALUES (NEW.cliente_id, 1, 1)
    ON CONFLICT (cliente_id) DO UPDATE
    SET giros_disponibles = ruleta_giros_disponibles.giros_disponibles + 1,
        total_ganados = ruleta_giros_disponibles.total_ganados + 1,
        updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_asignar_giro ON public.pedidos;
CREATE TRIGGER trg_auto_asignar_giro
  AFTER UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_asignar_giro_por_pedido();

-- ============================================================
-- 7. RPC: girar_ruleta — server-side, anti-trampas
-- ============================================================
CREATE OR REPLACE FUNCTION public.girar_ruleta(p_cliente_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_giros integer;
  v_total_prob float;
  v_rand float;
  v_acum float := 0;
  v_premio record;
  v_giro_id uuid;
BEGIN
  -- Lock row para evitar giros simultáneos (race condition)
  SELECT giros_disponibles INTO v_giros
  FROM public.ruleta_giros_disponibles
  WHERE cliente_id = p_cliente_id
  FOR UPDATE;

  IF v_giros IS NULL OR v_giros <= 0 THEN
    RETURN jsonb_build_object('error', 'No tienes giros disponibles');
  END IF;

  -- Verificar que haya premios activos
  SELECT COALESCE(SUM(probabilidad::float), 0) INTO v_total_prob
  FROM public.ruleta_premios WHERE activo = true;

  IF v_total_prob = 0 THEN
    RETURN jsonb_build_object('error', 'No hay premios configurados. Contacta al administrador.');
  END IF;

  -- Selección aleatoria ponderada
  v_rand := random() * v_total_prob;
  FOR v_premio IN
    SELECT * FROM public.ruleta_premios WHERE activo = true ORDER BY created_at
  LOOP
    v_acum := v_acum + v_premio.probabilidad;
    IF v_rand <= v_acum THEN EXIT; END IF;
  END LOOP;

  -- Descontar 1 giro
  UPDATE public.ruleta_giros_disponibles
  SET giros_disponibles = giros_disponibles - 1, updated_at = now()
  WHERE cliente_id = p_cliente_id;

  -- Registrar el giro
  INSERT INTO public.ruleta_giros (cliente_id, premio_id, premio_nombre, tipo, valor)
  VALUES (p_cliente_id, v_premio.id, v_premio.nombre, v_premio.tipo, v_premio.valor)
  RETURNING id INTO v_giro_id;

  -- Acreditar saldo si aplica
  IF v_premio.tipo = 'saldo_usd' AND v_premio.valor > 0 THEN
    UPDATE public.billeteras
    SET saldo = saldo + v_premio.valor WHERE auth_user_id = p_cliente_id;
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;
  ELSIF v_premio.tipo = 'saldo_bs' AND v_premio.valor > 0 THEN
    UPDATE public.billeteras
    SET saldo_bs = saldo_bs + v_premio.valor WHERE auth_user_id = p_cliente_id;
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;
  END IF;

  RETURN jsonb_build_object(
    'premio_id',          v_premio.id,
    'premio_nombre',      v_premio.nombre,
    'premio_descripcion', COALESCE(v_premio.descripcion, ''),
    'tipo',               v_premio.tipo,
    'valor',              v_premio.valor,
    'color',              v_premio.color,
    'emoji',              COALESCE(v_premio.emoji, '🎁'),
    'acreditado',         (v_premio.tipo IN ('saldo_usd', 'saldo_bs') AND v_premio.valor > 0),
    'giros_restantes',    (SELECT giros_disponibles FROM public.ruleta_giros_disponibles WHERE cliente_id = p_cliente_id)
  );
END;
$$;
