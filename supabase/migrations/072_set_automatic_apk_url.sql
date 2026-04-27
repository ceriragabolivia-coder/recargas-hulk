UPDATE public.configuracion 
SET valor_texto = 'https://vsmpxvzmferpqpfaulgb.supabase.co/storage/v1/object/public/logos/apps/latest-release.apk'
WHERE clave = 'apk_url' AND owner_id IS NULL;
