-- 091_user_notifications.sql
-- Create table for individual user notifications

CREATE TABLE IF NOT EXISTS notificaciones_usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    leido BOOLEAN DEFAULT FALSE,
    tipo TEXT, -- 'order_status', 'promo', etc.
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notificaciones_usuarios ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own notifications"
    ON notificaciones_usuarios FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications (mark as read)"
    ON notificaciones_usuarios FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins/System can insert notifications"
    ON notificaciones_usuarios FOR INSERT
    TO authenticated
    WITH CHECK (true); -- We'll rely on app logic for now, or check role if needed

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuarios_user_id ON notificaciones_usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuarios_leido ON notificaciones_usuarios(leido);
