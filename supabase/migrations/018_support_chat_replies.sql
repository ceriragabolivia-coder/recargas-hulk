-- 18. migration: 018_support_chat_replies.sql
-- Add support for message quoting (replies) in support chat.

ALTER TABLE soporte_mensajes 
ADD COLUMN IF NOT EXISTS quoted_id UUID REFERENCES soporte_mensajes(id);

-- Notify pgrst to reload schema cache to reflect the new column
NOTIFY pgrst, 'reload schema';
