-- ============================================================
-- Migración 136: La Ruleta de Premios queda exclusiva para clientes.
-- Los revendedores ya no pueden girar ni recibir giros vía regalo masivo.
-- ============================================================

-- 1. girar_ruleta: rechazar el giro si el usuario es revendedor (rol principal o adicional)
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
  -- Los revendedores no tienen acceso a la ruleta de premios
  IF EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = p_cliente_id AND LOWER(rol) = 'revendedor'
  ) OR EXISTS (
    SELECT 1 FROM public.usuario_roles_adicionales WHERE usuario_id = p_cliente_id AND LOWER(rol) = 'revendedor'
  ) THEN
    RETURN jsonb_build_object('error', 'Los revendedores no tienen acceso a la ruleta de premios');
  END IF;

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
    'giro_id',            v_giro_id,
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

-- 2. regalar_premio_masivo: ya no incluye revendedores entre los destinatarios elegibles
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

  -- 3. Iterar solo por clientes (los revendedores ya no son elegibles para la ruleta)
  FOR v_cliente IN
    SELECT p.id FROM public.perfiles p
    WHERE LOWER(p.rol) = 'cliente'
      AND NOT EXISTS (
        SELECT 1 FROM public.usuario_roles_adicionales ura
        WHERE ura.usuario_id = p.id AND LOWER(ura.rol) = 'revendedor'
      )
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

NOTIFY pgrst, 'reload schema';
