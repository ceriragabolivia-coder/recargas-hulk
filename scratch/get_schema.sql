-- query actual table schemas
CREATE OR REPLACE FUNCTION get_table_schema(p_table TEXT)
RETURNS JSON AS $$
DECLARE
  v_res JSON;
BEGIN
  SELECT json_agg(json_build_object('column_name', column_name, 'data_type', data_type))
  INTO v_res
  FROM information_schema.columns 
  WHERE table_name = p_table;
  RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
