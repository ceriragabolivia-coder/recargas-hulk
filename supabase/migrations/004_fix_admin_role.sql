-- ASIGNAR ROL DE ADMINISTRADOR (Ejecutar en Supabase SQL Editor)
UPDATE public.perfiles 
SET rol = 'admin' 
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'ceriraga@gmail.com'
);

-- Verificar el cambio
SELECT p.id, u.email, p.rol 
FROM public.perfiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'ceriraga@gmail.com';
