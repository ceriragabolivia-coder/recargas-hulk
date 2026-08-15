CREATE OR REPLACE FUNCTION public.get_all_recargas_debug()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    res JSONB;
BEGIN
    SELECT jsonb_agg(r) INTO res FROM (
        SELECT * FROM public.billetera_recargas WHERE estado = 'pendiente' ORDER BY created_at DESC LIMIT 10
    ) r;
    RETURN res;
END;
$$;
