-- MIGRATION: 165_admin_interfaces
-- Insert admin_interface setting if it doesn't exist

INSERT INTO public.configuracion (clave, valor_texto, descripcion)
VALUES ('admin_interface', 'default', 'Define la interfaz visual activa para el Panel de Administración (ej: default)')
ON CONFLICT (clave) DO NOTHING;
