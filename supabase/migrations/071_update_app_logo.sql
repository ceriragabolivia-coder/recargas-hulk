INSERT INTO public.configuracion (clave, valor)
VALUES 
  ('favicon_url', '/logo.jpg'),
  ('sidebar_logo_url', '/logo.jpg'),
  ('sidebar_title', 'Ceriraga')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;
