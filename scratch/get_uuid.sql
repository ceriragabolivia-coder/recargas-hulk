-- Create helper RPC
CREATE OR REPLACE FUNCTION get_pedido_uuid(p_num VARCHAR) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.pedidos WHERE numero_pedido = p_num;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
