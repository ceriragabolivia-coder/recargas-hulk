-- Migration: 063_fix_support_chat_rls.sql
-- Description: Fix soporte_mensajes RLS policies to use correct columns and profile table

-- 1. Eliminar políticas antiguas (limpieza)
DROP POLICY IF EXISTS "Admins pueden ver todos los chats" ON public.soporte_mensajes;
DROP POLICY IF EXISTS "Clientes pueden ver su propio chat" ON public.soporte_mensajes;
DROP POLICY IF EXISTS "Admins pueden enviar mensajes" ON public.soporte_mensajes;
DROP POLICY IF EXISTS "Clientes pueden enviar a su propio chat" ON public.soporte_mensajes;
DROP POLICY IF EXISTS "Admins pueden actualizar mensajes" ON public.soporte_mensajes;
DROP POLICY IF EXISTS "Clientes pueden actualizar sus mensajes" ON public.soporte_mensajes;

-- 2. Crear nuevas políticas robustas

-- SELECT: Admins ven todo, Clientes ven lo suyo
CREATE POLICY "soporte_mensajes_select_policy" ON public.soporte_mensajes
    FOR SELECT USING (
        -- Es admin
        EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
        OR
        -- Es el dueño del chat
        EXISTS (
            SELECT 1 FROM public.clientes c 
            WHERE c.auth_user_id = auth.uid() AND c.id = soporte_mensajes.cliente_id
        )
    );

-- INSERT: Admins envían a cualquier chat, Clientes envían a su propio chat
CREATE POLICY "soporte_mensajes_insert_policy" ON public.soporte_mensajes
    FOR INSERT WITH CHECK (
        -- Es admin
        EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
        OR
        -- Es el dueño del chat enviando a su propia sala
        EXISTS (
            SELECT 1 FROM public.clientes c 
            WHERE c.auth_user_id = auth.uid() AND c.id = soporte_mensajes.cliente_id
        )
    );

-- UPDATE: Admins actualizan todo (leído), Clientes lo suyo
CREATE POLICY "soporte_mensajes_update_policy" ON public.soporte_mensajes
    FOR UPDATE USING (
        -- Es admin
        EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
        OR
        -- Es el dueño del chat
        EXISTS (
            SELECT 1 FROM public.clientes c 
            WHERE c.auth_user_id = auth.uid() AND c.id = soporte_mensajes.cliente_id
        )
    );

-- DELETE: Solo admins o dueño
CREATE POLICY "soporte_mensajes_delete_policy" ON public.soporte_mensajes
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
    );

-- 3. Notificar recarga
NOTIFY pgrst, 'reload schema';
