CREATE OR REPLACE FUNCTION procesar_recarga_automatica_rpc(p_recarga_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recarga RECORD;
BEGIN
  SELECT * INTO v_recarga FROM billetera_recargas WHERE id = p_recarga_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Recarga no encontrada.');
  END IF;

  IF v_recarga.estado <> 'pendiente' THEN
    RETURN jsonb_build_object('success', false, 'message', 'La recarga ya no está pendiente.');
  END IF;

  UPDATE billetera_recargas
  SET estado = 'aprobado', updated_at = NOW()
  WHERE id = p_recarga_id;

  INSERT INTO billetera_transacciones (
    auth_user_id, tipo, monto, moneda, descripcion, referencia_id, status
  ) VALUES (
    v_recarga.auth_user_id, 'recarga', v_recarga.monto, v_recarga.moneda, 
    'Recarga automática de saldo vía ' || COALESCE((SELECT nombre FROM metodos_pago WHERE id = v_recarga.metodo_pago_id), 'Pago APK'), 
    p_recarga_id, 'completado'
  );

  IF v_recarga.moneda = 'usd' THEN
    INSERT INTO billeteras (auth_user_id, saldo, saldo_bs) 
    VALUES (v_recarga.auth_user_id, v_recarga.monto, 0)
    ON CONFLICT (auth_user_id) 
    DO UPDATE SET saldo = billeteras.saldo + EXCLUDED.saldo;
  ELSE
    INSERT INTO billeteras (auth_user_id, saldo, saldo_bs) 
    VALUES (v_recarga.auth_user_id, 0, v_recarga.monto)
    ON CONFLICT (auth_user_id) 
    DO UPDATE SET saldo_bs = billeteras.saldo_bs + EXCLUDED.saldo_bs;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Recarga aprobada automáticamente.');
END;
$$;
NOTIFY pgrst, 'reload schema';
