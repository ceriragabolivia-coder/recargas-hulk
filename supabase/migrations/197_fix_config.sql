DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'fazercards_api_key') THEN
        INSERT INTO public.configuracion (clave, valor, valor_texto, descripcion)
        VALUES ('fazercards_api_key', 0, 'fc_3e0467ab3d028115e317c2b1', 'Clave API para el proveedor FazerCards');
    ELSE
        UPDATE public.configuracion SET valor_texto = 'fc_3e0467ab3d028115e317c2b1' WHERE clave = 'fazercards_api_key';
    END IF;
END $$;
