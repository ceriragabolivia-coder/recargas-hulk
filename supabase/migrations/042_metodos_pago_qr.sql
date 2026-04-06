-- Migración 042: Añadir código QR a los métodos de pago
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'metodos_pago' AND column_name = 'qr_url') THEN
        ALTER TABLE public.metodos_pago ADD COLUMN qr_url TEXT;
    END IF;
    
    -- Asegurarnos de que icono_url existe (aunque los hooks ya lo usan)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'metodos_pago' AND column_name = 'icono_url') THEN
        ALTER TABLE public.metodos_pago ADD COLUMN icono_url TEXT;
    END IF;
END $$;
