-- Migration: 139_landing_conecta2ve_custom.sql
-- Description: Inserta configuraciones por defecto para el rediseño estilo Conecta2VE de la landing page.

DO $$
BEGIN
    -- Colores por defecto (Tema Oscuro + Acento Verde Neón)
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_bg_color' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_bg_color', 0, 'Color de fondo de la Landing Page', '#0f0f10', NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_card_bg' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_card_bg', 0, 'Color de fondo de las tarjetas', '#1a1d21', NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_border_color' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_border_color', 0, 'Color de borde de los elementos', '#27272a', NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_text_main' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_text_main', 0, 'Color de texto principal', '#ffffff', NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_text_muted' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_text_muted', 0, 'Color de texto secundario/atenuado', '#a1a1aa', NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_accent_color' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_accent_color', 0, 'Color de acento primario (Ej: Neón)', '#a3e635', NULL);
    END IF;

    -- Toggles de visualización de secciones (1 = Mostrar, 0 = Ocultar)
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_show_hero' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_show_hero', 1, 'Mostrar sección del Hero/Banners (1=si, 0=no)', '1', NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_show_bestsellers' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_show_bestsellers', 1, 'Mostrar sección de Más Vendidos (1=si, 0=no)', '1', NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_show_sliders' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_show_sliders', 1, 'Mostrar categorías como controles deslizantes horizontales (1=si, 0=no)', '1', NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_show_benefits' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_show_benefits', 1, 'Mostrar sección de Beneficios (1=si, 0=no)', '1', NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_show_reviews' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_show_reviews', 1, 'Mostrar sección de Opiniones (1=si, 0=no)', '1', NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_show_faq' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_show_faq', 1, 'Mostrar sección de Preguntas Frecuentes (1=si, 0=no)', '1', NULL);
    END IF;

    -- Contenido de Beneficios (JSON)
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_benefits_json' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_benefits_json', 0, 'Lista de beneficios en formato JSON', '[{"id":1,"icon":"⚡","title":"Entrega en 1-5 Minutos","desc":"La mayoría de las recargas se procesan de manera automatizada y se entregan al instante."},{"id":2,"icon":"🛡️","title":"Verificación Segura","desc":"Validamos el ID del jugador antes de que completes el pago para evitar errores."},{"id":3,"icon":"💳","title":"Múltiples Métodos de Pago","desc":"Aceptamos Pago Móvil, Binance Pay, Zelle y transferencias en Bolívares."},{"id":4,"icon":"🤖","title":"Servicio 24/7","desc":"Nuestra plataforma está disponible las 24 horas del día, los 7 días de la semana."}]', NULL);
    END IF;

    -- Contenido de Opiniones (JSON)
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_reviews_json' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_reviews_json', 0, 'Opiniones de clientes en formato JSON', '[{"id":1,"name":"Carlos M.","rating":5,"comment":"Excelente servicio, la recarga de Free Fire llegó en menos de 2 minutos. Muy recomendado!"},{"id":2,"name":"Andrea G.","rating":5,"comment":"La verificación del ID evita errores. Es la mejor página de recargas en Venezuela."},{"id":3,"name":"Luis P.","rating":5,"comment":"Rápido y seguro. Pagué con Pago Móvil y fue instantáneo."}]', NULL);
    END IF;

    -- Contenido de FAQs (JSON)
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_faq_json' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_faq_json', 0, 'Preguntas frecuentes en formato JSON', '[{"id":1,"question":"¿Cuánto tiempo tarda en llegar mi recarga?","answer":"La mayoría de las recargas se procesan de manera automática y se entregan en un lapso de 1 a 5 minutos."},{"id":2,"question":"¿Qué métodos de pago aceptan?","answer":"Aceptamos Pago Móvil, Binance Pay, Zelle y transferencias en Bolívares."},{"id":3,"question":"¿Qué pasa si introduzco un ID de jugador incorrecto?","answer":"Gracias a nuestro sistema de verificación de ID, validamos el nombre del jugador antes de que completes el pago, evitando que pierdas tu dinero."}]', NULL);
    END IF;

END $$;
