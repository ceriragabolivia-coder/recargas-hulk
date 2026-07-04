-- Fix RLS policies for pedido_items table
-- Allow authenticated users to insert items for their own orders

-- Enable RLS if not already enabled
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;

-- Drop existing insert policy if exists to avoid conflicts
DROP POLICY IF EXISTS "Usuarios pueden insertar sus propios items" ON pedido_items;
DROP POLICY IF EXISTS "pedido_items_insert_policy" ON pedido_items;
DROP POLICY IF EXISTS "Users can insert pedido_items" ON pedido_items;
DROP POLICY IF EXISTS "Allow authenticated insert pedido_items" ON pedido_items;

-- Allow authenticated users to insert items into their own orders
CREATE POLICY "Usuarios pueden insertar sus propios items"
ON pedido_items
FOR INSERT
TO authenticated
WITH CHECK (
  pedido_id IN (
    SELECT id FROM pedidos WHERE cliente_id = auth.uid()
  )
);

-- Allow users to read their own items
DROP POLICY IF EXISTS "Usuarios pueden ver sus propios items" ON pedido_items;
CREATE POLICY "Usuarios pueden ver sus propios items"
ON pedido_items
FOR SELECT
TO authenticated
USING (
  pedido_id IN (
    SELECT id FROM pedidos WHERE cliente_id = auth.uid()
  )
);

-- Allow admins to do everything
DROP POLICY IF EXISTS "Admins pueden gestionar todos los items" ON pedido_items;
CREATE POLICY "Admins pueden gestionar todos los items"
ON pedido_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'operador', 'soporte')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'operador', 'soporte')
  )
);
