-- Crear función RPC para cargar todos los datos de la billetera en una sola petición
CREATE OR REPLACE FUNCTION get_wallet_data_rpc(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet JSONB;
    v_admin_sales JSONB;
    v_recargas JSONB;
    v_transacciones JSONB;
    v_metodos JSONB;
BEGIN
    -- 1. Billetera del usuario
    SELECT row_to_json(b) INTO v_wallet
    FROM public.billeteras b
    WHERE b.auth_user_id = p_user_id
    LIMIT 1;

    -- 2. Saldo de Operaciones (Solo si existe en admin_saldos)
    SELECT row_to_json(a) INTO v_admin_sales
    FROM public.admin_saldos a
    WHERE a.auth_user_id = p_user_id
    LIMIT 1;

    -- 3. Recargas con método de pago
    SELECT json_agg(row_to_json(r_full)) INTO v_recargas
    FROM (
        SELECT r.*, json_build_object('nombre', m.nombre) as metodos_pago
        FROM public.billetera_recargas r
        LEFT JOIN public.metodos_pago m ON r.metodo_pago_id = m.id
        WHERE r.auth_user_id = p_user_id
        ORDER BY r.created_at DESC
    ) r_full;

    -- 4. Transacciones
    SELECT json_agg(row_to_json(t)) INTO v_transacciones
    FROM (
        SELECT * FROM public.billetera_transacciones
        WHERE auth_user_id = p_user_id
        ORDER BY created_at DESC
    ) t;

    -- 5. Métodos de Pago
    SELECT json_agg(row_to_json(m)) INTO v_metodos
    FROM (
        SELECT * FROM public.metodos_pago
        ORDER BY nombre
    ) m;

    RETURN jsonb_build_object(
        'wallet', v_wallet,
        'admin_sales', v_admin_sales,
        'recargas', COALESCE(v_recargas, '[]'::jsonb),
        'transacciones', COALESCE(v_transacciones, '[]'::jsonb),
        'metodos', COALESCE(v_metodos, '[]'::jsonb)
    );
END;
$$;
