-- Añadir columna api_provider a la tabla juegos
ALTER TABLE public.juegos ADD COLUMN api_provider TEXT DEFAULT 'tiendagiftven' NOT NULL;

-- Insertar la clave de FazerCards en configuracion
INSERT INTO public.configuracion (clave, valor, valor_texto, descripcion)
VALUES ('fazercards_api_key', 0, 'fc_3e0467ab3d028115e317c2b1', 'Clave API para el proveedor FazerCards')
ON CONFLICT (clave) DO UPDATE SET valor_texto = EXCLUDED.valor_texto;
