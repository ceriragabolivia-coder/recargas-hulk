-- Migration: Soporte - Respuestas Rápidas
CREATE TABLE IF NOT EXISTS public.soporte_respuestas_rapidas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.soporte_respuestas_rapidas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins pueden todo en respuestas rápidas" 
ON public.soporte_respuestas_rapidas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE perfiles.id = auth.uid() 
    AND perfiles.rol = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE perfiles.id = auth.uid() 
    AND perfiles.rol = 'admin'
  )
);

CREATE POLICY "Clientes pueden ver respuestas rápidas" 
ON public.soporte_respuestas_rapidas
FOR SELECT
TO authenticated
USING (true);
