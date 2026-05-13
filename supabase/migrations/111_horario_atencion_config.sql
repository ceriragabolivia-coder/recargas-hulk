-- 111_horario_atencion_config.sql
-- Agregar configuraciones para el pop-up de horario de atención

INSERT INTO configuracion (clave, valor, descripcion, valor_texto) VALUES
    ('show_horario_popup', 0, 'Habilitar pop-up de horario (1=si, 0=no)', 'false'),
    ('horario_atencion_texto', 0, 'Texto del horario (Ej: 8:00 AM - 10:00 PM)', 'Lun-Vie: 8am-8pm | Sab-Dom: 8am-6pm'),
    ('horario_flyer_url', 0, 'URL del flyer del horario', 'file:///C:/Users/cerir/.gemini/antigravity/brain/f39a8780-5c16-442b-8535-9741e728dd75/horario_laboral_final_flyer_v2_1778649574374.png')
ON CONFLICT (clave) DO UPDATE SET valor_texto = EXCLUDED.valor_texto, valor = EXCLUDED.valor;
