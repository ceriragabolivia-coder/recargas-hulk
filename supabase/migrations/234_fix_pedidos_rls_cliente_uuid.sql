-- Migración 234: Ampliar RLS de pedidos para soportar cliente_id almacenado
-- como auth UUID o como UUID de la tabla clientes (clientes.id)
--
-- PROBLEMA: Algunos pedidos fueron creados con cliente_id = auth.uid() (correcto)
-- y otros con cliente_id = clientes.id (UUID del perfil, no del auth).
-- La RLS anterior solo permitía el primer caso.

-- Remover política anterior de SELECT para clientes
DROP POLICY IF EXISTS "pedidos_user_select" ON public.pedidos;

-- Nueva política: permite ver el pedido si:
-- 1. cliente_id = auth.uid() (formato auth UUID) ← caso normal
-- 2. existe un registro en clientes con auth_user_id = auth.uid() y id = pedidos.cliente_id
--    (caso donde se guardó con clientes.id en lugar de auth.uid())
CREATE POLICY "pedidos_user_select" ON public.pedidos
    FOR SELECT TO authenticated USING (
        cliente_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.clientes
            WHERE clientes.auth_user_id = auth.uid()
              AND clientes.id = pedidos.cliente_id
        )
    );
