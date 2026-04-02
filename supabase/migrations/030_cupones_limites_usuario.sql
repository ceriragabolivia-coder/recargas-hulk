-- Agregar limite de usos globales por usuario y frecuencia de uso
ALTER TABLE IF EXISTS public.cupones
ADD COLUMN IF NOT EXISTS limite_usos_por_usuario integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS frecuencia_uso varchar(20) DEFAULT 'unico';

-- Opcionalmente, agregar una restricción CHECK en frecuencia_uso para que solo admita valores conocidos
-- ALTER TABLE public.cupones ADD CONSTRAINT chk_frecuencia_uso CHECK (frecuencia_uso IN ('unico', '24h', 'semanal', 'mensual', 'ilimitado'));
