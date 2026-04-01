-- 1. Crear tabla para los mensajes de soporte
CREATE TABLE IF NOT EXISTS soporte_mensajes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE, -- ID del perfil del cliente (sala de chat)
  remitente_id UUID REFERENCES clientes(id) ON DELETE CASCADE, -- Perfil de quien envía (puede ser admin o el mismo cliente)
  mensaje TEXT NOT NULL,
  leido BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar Row Level Security
ALTER TABLE soporte_mensajes ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Seguridad (RLS)

-- Los administradores pueden ver todos los mensajes
CREATE POLICY "Admins pueden ver todos los chats" ON soporte_mensajes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clientes c 
      WHERE c.auth_id = auth.uid() AND c.rol = 'admin'
    )
  );

-- Los clientes solo pueden ver los mensajes de su propio chat (donde cliente_id es su perfil)
CREATE POLICY "Clientes pueden ver su propio chat" ON soporte_mensajes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clientes c 
      WHERE c.auth_id = auth.uid() AND c.id = soporte_mensajes.cliente_id
    )
  );

-- Los administradores pueden enviar mensajes a cualquier chat
CREATE POLICY "Admins pueden enviar mensajes" ON soporte_mensajes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clientes c 
      WHERE c.auth_id = auth.uid() AND c.rol = 'admin'
    )
  );

-- Los clientes solo pueden enviar mensajes a su propio chat
CREATE POLICY "Clientes pueden enviar a su propio chat" ON soporte_mensajes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clientes c 
      WHERE c.auth_id = auth.uid() AND c.id = soporte_mensajes.cliente_id
    )
  );

-- Los admins pueden actualizar mensajes (para marcarlos como leídos)
CREATE POLICY "Admins pueden actualizar mensajes" ON soporte_mensajes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clientes c 
      WHERE c.auth_id = auth.uid() AND c.rol = 'admin'
    )
  );

-- Los clientes pueden actualizar mensajes en su chat (para marcarlos como leídos)
CREATE POLICY "Clientes pueden actualizar sus mensajes" ON soporte_mensajes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clientes c 
      WHERE c.auth_id = auth.uid() AND c.id = soporte_mensajes.cliente_id
    )
  );

-- Permitir suscripciones realtime para esta tabla
-- Nota: Supabase bloquea replication para nuevas tablas por defecto
alter publication supabase_realtime add table soporte_mensajes;
