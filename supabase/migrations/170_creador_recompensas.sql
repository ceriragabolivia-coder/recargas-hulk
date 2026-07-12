CREATE TABLE IF NOT EXISTS public.creador_objetivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_id UUID REFERENCES public.codigos_creadores(id) ON DELETE CASCADE, -- Si es NULL, es un objetivo global
    meta_registros INTEGER NOT NULL,
    producto_1_id INT REFERENCES public.productos(id) ON DELETE SET NULL,
    producto_2_id INT REFERENCES public.productos(id) ON DELETE SET NULL,
    producto_3_id INT REFERENCES public.productos(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE NULLS NOT DISTINCT (codigo_id, meta_registros)
);

ALTER TABLE public.creador_objetivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read creador_objetivos" ON public.creador_objetivos FOR SELECT USING (true);
CREATE POLICY "Admin full access creador_objetivos" ON public.creador_objetivos FOR ALL USING (
  EXISTS (SELECT 1 FROM perfiles WHERE perfiles.id = auth.uid() AND (perfiles.rol = 'admin' OR perfiles.rol = 'administrador'))
);

CREATE TABLE IF NOT EXISTS public.creador_recompensas_canjeadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objetivo_id UUID REFERENCES public.creador_objetivos(id) ON DELETE CASCADE,
    codigo_id UUID REFERENCES public.codigos_creadores(id) ON DELETE CASCADE,
    creador_auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    producto_elegido_id INT REFERENCES public.productos(id) ON DELETE SET NULL,
    pedido_id INT REFERENCES public.pedidos(id) ON DELETE SET NULL,
    fecha_canje TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(objetivo_id, codigo_id)
);

ALTER TABLE public.creador_recompensas_canjeadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read creador_recompensas_canjeadas" ON public.creador_recompensas_canjeadas FOR SELECT USING (true);
CREATE POLICY "Users can see own creador_recompensas_canjeadas" ON public.creador_recompensas_canjeadas FOR SELECT USING (creador_auth_id = auth.uid());
CREATE POLICY "Creators insert creador_recompensas_canjeadas" ON public.creador_recompensas_canjeadas FOR INSERT WITH CHECK (
    creador_auth_id = auth.uid()
);
CREATE POLICY "Admin full access creador_recompensas_canjeadas" ON public.creador_recompensas_canjeadas FOR ALL USING (
  EXISTS (SELECT 1 FROM perfiles WHERE perfiles.id = auth.uid() AND (perfiles.rol = 'admin' OR perfiles.rol = 'administrador'))
);
