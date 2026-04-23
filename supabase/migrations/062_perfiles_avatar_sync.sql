-- Migration: Add avatar_url to perfiles table and sync with clientes
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Sync existing data from clientes to perfiles
UPDATE public.perfiles p
SET 
    avatar_url = c.avatar_url,
    nickname = c.nickname
FROM public.clientes c
WHERE c.auth_user_id = p.id;
