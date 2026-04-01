-- Añadir método de recarga a juegos
ALTER TABLE public.juegos ADD COLUMN IF NOT EXISTS metodo_recarga VARCHAR(50) DEFAULT 'id_jugador';
-- id_jugador: Requiere ID del jugador
-- cuenta_completa: Requiere Correo y Clave
