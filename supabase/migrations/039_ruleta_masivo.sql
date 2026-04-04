-- ============================================================
-- Migración 039: Función para Regalos Masivos de la Ruleta
-- ============================================================

CREATE OR REPLACE FUNCTION public.regalar_premio_masivo(p_premio_id uuid, p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_premio record;
  v_count integer := 0;
  v_cliente record;
  v_giro_id uuid;
BEGIN
  -- 1. Verificar que el que llama es admin (seguridad extra)
  IF NOT EXISTS (SELECT 1 FROM public.perfiles WHERE id = p_admin_id AND LOWER(rol) = 'admin') THEN
    RETURN jsonb_build_object('error', 'No tienes permisos de administrador');
  END IF;

  -- 2. Obtener datos del premio
  SELECT * INTO v_premio FROM public.ruleta_premios WHERE id = p_premio_id;
  IF v_premio IS NULL THEN
    RETURN jsonb_build_object('error', 'Premio no encontrado');
  END IF;

  -- 3. Iterar por todos los clientes y revendedores activos
  FOR v_cliente IN 
    SELECT id FROM public.perfiles 
    WHERE LOWER(rol) IN ('cliente', 'revendedor')
  LOOP
    -- Registrar el giro en el historial (marcado como regalo)
    INSERT INTO public.ruleta_giros (cliente_id, premio_id, premio_nombre, tipo, valor, acreditado)
    VALUES (v_cliente.id, v_premio.id, v_premio.nombre, v_premio.tipo, v_premio.valor, true)
    RETURNING id INTO v_giro_id;

    -- Aplicar el premio según el tipo
    IF v_premio.tipo = 'saldo_usd' AND v_premio.valor > 0 THEN
      UPDATE public.billetera SET saldo = saldo + v_premio.valor WHERE cliente_id = v_cliente.id;
    ELSIF v_premio.tipo = 'saldo_bs' AND v_premio.valor > 0 THEN
      UPDATE public.billetera SET saldo_bs = saldo_bs + v_premio.valor WHERE cliente_id = v_cliente.id;
    ELSIF v_premio.tipo = 'descuento' AND v_premio.valor > 0 THEN
      -- Se guarda como descuento pendiente para que lo usen en el checkout cuando quieran
      INSERT INTO public.ruleta_descuentos_pendientes (cliente_id, giro_id, porcentaje, nombre)
      VALUES (v_cliente.id, v_giro_id, v_premio.valor, v_premio.nombre);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'usuarios_afectados', v_count, 'premio', v_premio.nombre);
END;
$$;
