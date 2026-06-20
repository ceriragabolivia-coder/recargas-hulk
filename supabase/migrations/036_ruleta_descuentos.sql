-- ============================================================
-- Migración 036: Descuentos de Ruleta almacenados por usuario
-- ============================================================

-- Tabla para guardar descuentos ganados pendientes de uso
CREATE TABLE IF NOT EXISTS public.ruleta_descuentos_pendientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES auth.users(id),
  giro_id uuid REFERENCES public.ruleta_giros(id),
  porcentaje numeric NOT NULL,
  nombre text NOT NULL,
  usado boolean DEFAULT false,
  pedido_id INT REFERENCES public.pedidos(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ruleta_descuentos_pendientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rdp_own_select" ON public.ruleta_descuentos_pendientes
  FOR SELECT USING (cliente_id = auth.uid());

CREATE POLICY "rdp_own_update" ON public.ruleta_descuentos_pendientes
  FOR UPDATE USING (cliente_id = auth.uid());

CREATE POLICY "rdp_admin_all" ON public.ruleta_descuentos_pendientes
  FOR ALL USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- ============================================================
-- Actualizar girar_ruleta para manejar tipo 'descuento'
-- (saldo_usd y saldo_bs se acreditan al instante,
--  descuento se almacena para que el usuario lo aplique luego)
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
  SELECT giros_disponibles INTO v_giros
  FROM public.ruleta_giros_disponibles
  WHERE cliente_id = p_cliente_id FOR UPDATE;

  IF v_giros IS NULL OR v_giros <= 0 THEN
    RETURN jsonb_build_object('error', 'No tienes giros disponibles');
  END IF;

  SELECT COALESCE(SUM(probabilidad::float), 0) INTO v_total_prob
  FROM public.ruleta_premios WHERE activo = true;

  IF v_total_prob = 0 THEN
    RETURN jsonb_build_object('error', 'No hay premios configurados');
  END IF;

  v_rand := random() * v_total_prob;
  FOR v_premio IN SELECT * FROM public.ruleta_premios WHERE activo = true ORDER BY created_at LOOP
    v_acum := v_acum + v_premio.probabilidad;
    IF v_rand <= v_acum THEN EXIT; END IF;
  END LOOP;

  UPDATE public.ruleta_giros_disponibles
  SET giros_disponibles = giros_disponibles - 1, updated_at = now()
  WHERE cliente_id = p_cliente_id;

  INSERT INTO public.ruleta_giros (cliente_id, premio_id, premio_nombre, tipo, valor)
  VALUES (p_cliente_id, v_premio.id, v_premio.nombre, v_premio.tipo, v_premio.valor)
  RETURNING id INTO v_giro_id;

  -- Aplicar premio según tipo
  IF v_premio.tipo = 'saldo_usd' AND v_premio.valor > 0 THEN
    UPDATE public.billetera SET saldo = saldo + v_premio.valor WHERE cliente_id = p_cliente_id;
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;

  ELSIF v_premio.tipo = 'saldo_bs' AND v_premio.valor > 0 THEN
    UPDATE public.billetera SET saldo_bs = saldo_bs + v_premio.valor WHERE cliente_id = p_cliente_id;
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;

  ELSIF v_premio.tipo = 'descuento' AND v_premio.valor > 0 THEN
    -- Almacenar descuento para que el usuario lo aplique cuando quiera
    INSERT INTO public.ruleta_descuentos_pendientes (cliente_id, giro_id, porcentaje, nombre)
    VALUES (p_cliente_id, v_giro_id, v_premio.valor, v_premio.nombre);
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;
  END IF;

  RETURN jsonb_build_object(
    'premio_id',          v_premio.id,
    'premio_nombre',      v_premio.nombre,
    'premio_descripcion', COALESCE(v_premio.descripcion, ''),
    'tipo',               v_premio.tipo,
    'valor',              v_premio.valor,
    'color',              v_premio.color,
    'emoji',              COALESCE(v_premio.emoji, 'gift'),
    'acreditado',         (v_premio.tipo IN ('saldo_usd', 'saldo_bs') AND v_premio.valor > 0),
    'descuento_guardado', (v_premio.tipo = 'descuento' AND v_premio.valor > 0),
    'giros_restantes',    (SELECT giros_disponibles FROM public.ruleta_giros_disponibles WHERE cliente_id = p_cliente_id)
  );
END;
$$;
