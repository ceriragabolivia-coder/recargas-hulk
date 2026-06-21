-- Migration: 140_fix_historial_tasas_trigger.sql
-- Description: Redefinir la función guardar_historial_tasas con SECURITY DEFINER para evitar errores de RLS al actualizar configuraciones.

CREATE OR REPLACE FUNCTION public.guardar_historial_tasas()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.valor IS DISTINCT FROM NEW.valor THEN
        INSERT INTO public.historial_tasas (tasa_binance, tasa_dolar, real_dolar, costo_pinsmile)
        SELECT 
            (SELECT valor FROM public.configuracion WHERE clave = 'tasa_binance'),
            (SELECT valor FROM public.configuracion WHERE clave = 'tasa_dolar'),
            (SELECT valor FROM public.configuracion WHERE clave = 'real_dolar'),
            (SELECT valor FROM public.configuracion WHERE clave = 'costo_pinsmile');
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recargar caché de esquema
NOTIFY pgrst, 'reload schema';
