-- ============================================================
-- Migración 105: Corrección de lógica de acreditación de premios en ruleta (billetera)
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
  -- Lock row para evitar giros simultáneos
  SELECT giros_disponibles INTO v_giros
  FROM public.ruleta_giros_disponibles
  WHERE cliente_id = p_cliente_id
  FOR UPDATE;

  IF v_giros IS NULL OR v_giros <= 0 THEN
    RETURN jsonb_build_object('error', 'No tienes giros disponibles');
  END IF;

  -- Verificar que haya premios activos con probabilidad real
  SELECT COALESCE(SUM(probabilidad::float), 0) INTO v_total_prob
  FROM public.ruleta_premios 
  WHERE activo = true AND probabilidad > 0;

  IF v_total_prob = 0 THEN
    RETURN jsonb_build_object('error', 'No hay premios con probabilidad configurados.');
  END IF;

  -- Selección aleatoria ponderada (excluyendo probabilidad 0)
  v_rand := random() * v_total_prob;
  FOR v_premio IN
    SELECT * FROM public.ruleta_premios 
    WHERE activo = true AND probabilidad > 0 
    ORDER BY created_at
  LOOP
    v_acum := v_acum + v_premio.probabilidad;
    -- Usamos < para evitar el borde de 0 si v_rand es exactamente 0
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

  -- Acreditar premio según tipo
  IF v_premio.tipo = 'saldo_usd' AND v_premio.valor > 0 THEN
    INSERT INTO public.billeteras (auth_user_id, saldo)
    VALUES (p_cliente_id, v_premio.valor)
    ON CONFLICT (auth_user_id) 
    DO UPDATE SET saldo = public.billeteras.saldo + v_premio.valor, updated_at = now();
    
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;

    -- Opcional: Registrar transacción en la billetera
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_cliente_id, v_premio.valor, 'ajuste_admin', 'Premio de Ruleta: ' || v_premio.nombre, v_giro_id::text, 'usd');

  ELSIF v_premio.tipo = 'saldo_bs' AND v_premio.valor > 0 THEN
    INSERT INTO public.billeteras (auth_user_id, saldo_bs)
    VALUES (p_cliente_id, v_premio.valor)
    ON CONFLICT (auth_user_id) 
    DO UPDATE SET saldo_bs = public.billeteras.saldo_bs + v_premio.valor, updated_at = now();
    
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;

    -- Opcional: Registrar transacción en la billetera
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_cliente_id, v_premio.valor, 'ajuste_admin', 'Premio de Ruleta: ' || v_premio.nombre, v_giro_id::text, 'bs');

  ELSIF v_premio.tipo = 'descuento' AND v_premio.valor > 0 THEN
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
    'emoji',              COALESCE(v_premio.emoji, '🎁'),
    'acreditado',         (v_premio.tipo IN ('saldo_usd', 'saldo_bs') AND v_premio.valor > 0),
    'descuento_guardado', (v_premio.tipo = 'descuento' AND v_premio.valor > 0),
    'giros_restantes',    (SELECT giros_disponibles FROM public.ruleta_giros_disponibles WHERE cliente_id = p_cliente_id)
  );
END;
$$;
