-- Migración para añadir programación horaria a los mensajes del sistema (popups)
ALTER TABLE mensajes_sistema ADD COLUMN IF NOT EXISTS hora_inicio TIME;
ALTER TABLE mensajes_sistema ADD COLUMN IF NOT EXISTS hora_fin TIME;

COMMENT ON COLUMN mensajes_sistema.hora_inicio IS 'Hora a la que el popup debe empezar a mostrarse (HH:MM:SS)';
COMMENT ON COLUMN mensajes_sistema.hora_fin IS 'Hora a la que el popup debe dejar de mostrarse (HH:MM:SS)';
