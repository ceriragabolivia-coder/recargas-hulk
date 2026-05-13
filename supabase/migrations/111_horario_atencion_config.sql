-- 111_horario_atencion_config.sql
-- Agregar configuraciones para el pop-up de horario de atención

INSERT INTO configuracion (clave, valor, descripcion, valor_texto) VALUES
    ('show_horario_popup', 0, 'Habilitar pop-up de horario (1=si, 0=no)', 'false'),
    ('horario_atencion_texto', 0, 'Texto del horario (Ej: 8:00 AM - 10:00 PM)', 'Lunes a Domingo: 8:00 AM - 10:00 PM'),
    ('horario_flyer_url', 0, 'URL del flyer del horario', 'file:///C:/Users/cerir/.gemini/antigravity/brain/f39a8780-5c16-442b-8535-9741e728dd75/horario_atencion_flyer_1778649148181.png')
ON CONFLICT (clave) DO UPDATE SET valor_texto = EXCLUDED.valor_texto, valor = EXCLUDED.valor;
