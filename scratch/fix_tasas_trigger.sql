-- Fix trigger historial_tasas to use numeric values
CREATE OR REPLACE FUNCTION public.guardar_historial_tasas()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.valor IS DISTINCT FROM NEW.valor THEN
        INSERT INTO public.historial_tasas (tasa_binance, tasa_dolar, real_dolar, costo_pinsmile)
        SELECT 
            COALESCE((SELECT valor::NUMERIC FROM public.configuracion WHERE clave = 'tasa_binance'), 0),
            COALESCE((SELECT valor::NUMERIC FROM public.configuracion WHERE clave = 'tasa_dolar'), 0),
            COALESCE((SELECT valor::NUMERIC FROM public.configuracion WHERE clave = 'real_dolar'), 0),
            COALESCE((SELECT valor::NUMERIC FROM public.configuracion WHERE clave = 'costo_pinsmile'), 0);
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
