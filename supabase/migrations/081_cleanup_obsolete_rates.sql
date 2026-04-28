
-- Migración 081: Limpieza de tasas obsoletas
-- Elimina tasa_binance para centralizar todo en tasa_dolar (Tasa Oficial)

DELETE FROM public.configuracion WHERE clave = 'tasa_binance';

-- Asegurar que tasa_dolar existe
INSERT INTO public.configuracion (clave, valor, owner_id)
SELECT 'tasa_dolar', 650, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'tasa_dolar' AND owner_id IS NULL);
