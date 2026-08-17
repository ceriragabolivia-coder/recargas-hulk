-- 223_fix_referidos_objetivos_schema.sql

DROP TABLE IF EXISTS public.referidos_recompensas_canjeadas CASCADE;
DROP TABLE IF EXISTS public.referidos_objetivos CASCADE;

CREATE TABLE public.referidos_objetivos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    meta_registros_activos integer NOT NULL,
    compras_minimas_usuario integer DEFAULT 1 NOT NULL,
    recompensa_tipo varchar(50) NOT NULL, -- 'saldo_bs', 'saldo_usd', 'producto'
    recompensa_valor numeric NOT NULL, -- Monto o ID de producto
    estado boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.referidos_recompensas_canjeadas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    objetivo_id uuid NOT NULL REFERENCES public.referidos_objetivos(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(cliente_id, objetivo_id)
);

ALTER TABLE public.referidos_objetivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referidos_recompensas_canjeadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to referidos_objetivos" ON public.referidos_objetivos FOR SELECT USING (true);

CREATE POLICY "Users can view their own referidos_recompensas_canjeadas" ON public.referidos_recompensas_canjeadas FOR SELECT USING (
  cliente_id IN (SELECT id FROM clientes WHERE auth_user_id = auth.uid())
);
