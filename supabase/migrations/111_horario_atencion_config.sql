-- 111_horario_atencion_config.sql
-- Agregar configuraciones para el pop-up de horario de atención

DO $$
BEGIN
    -- show_horario_popup
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'show_horario_popup' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('show_horario_popup', 0, 'Habilitar pop-up de horario (1=si, 0=no)', 'false', NULL);
    ELSE
        UPDATE public.configuracion SET valor_texto = 'false', valor = 0 WHERE clave = 'show_horario_popup' AND owner_id IS NULL;
    END IF;

    -- horario_atencion_texto
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'horario_atencion_texto' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('horario_atencion_texto', 0, 'Texto del horario (Ej: 8:00 AM - 10:00 PM)', 'Lun-Vie: 8am-8pm | Sab-Dom: 8am-6pm', NULL);
    ELSE
        UPDATE public.configuracion SET valor_texto = 'Lun-Vie: 8am-8pm | Sab-Dom: 8am-6pm', valor = 0 WHERE clave = 'horario_atencion_texto' AND owner_id IS NULL;
    END IF;

    -- horario_flyer_url
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'horario_flyer_url' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('horario_flyer_url', 0, 'URL del flyer del horario', 'file:///C:/Users/cerir/.gemini/antigravity/brain/f39a8780-5c16-442b-8535-9741e728dd75/horario_laboral_final_flyer_v2_1778649574374.png', NULL);
    ELSE
        UPDATE public.configuracion SET valor_texto = 'file:///C:/Users/cerir/.gemini/antigravity/brain/f39a8780-5c16-442b-8535-9741e728dd75/horario_laboral_final_flyer_v2_1778649574374.png', valor = 0 WHERE clave = 'horario_flyer_url' AND owner_id IS NULL;
    END IF;
END $$;
