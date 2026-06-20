DO $$
BEGIN
    -- favicon_url
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'favicon_url') THEN
        INSERT INTO public.configuracion (clave, valor, valor_texto, descripcion)
        VALUES ('favicon_url', 0, '/logo.jpg', 'URL del Favicon');
    ELSE
        UPDATE public.configuracion SET valor_texto = '/logo.jpg' WHERE clave = 'favicon_url';
    END IF;

    -- sidebar_logo_url
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'sidebar_logo_url') THEN
        INSERT INTO public.configuracion (clave, valor, valor_texto, descripcion)
        VALUES ('sidebar_logo_url', 0, '/logo.jpg', 'URL del logo lateral');
    ELSE
        UPDATE public.configuracion SET valor_texto = '/logo.jpg' WHERE clave = 'sidebar_logo_url';
    END IF;

    -- sidebar_title
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'sidebar_title') THEN
        INSERT INTO public.configuracion (clave, valor, valor_texto, descripcion)
        VALUES ('sidebar_title', 0, 'Ceriraga', 'Título lateral');
    ELSE
        UPDATE public.configuracion SET valor_texto = 'Ceriraga' WHERE clave = 'sidebar_title';
    END IF;
END $$;
