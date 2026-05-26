-- create an rpc to query column type
CREATE OR REPLACE FUNCTION get_col_type(p_table TEXT, p_col TEXT)
RETURNS TEXT AS $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT data_type INTO v_type 
  FROM information_schema.columns 
  WHERE table_name = p_table AND column_name = p_col;
  RETURN v_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
