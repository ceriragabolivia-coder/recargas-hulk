-- 220_sistema_referidos.sql

-- 1. Añadir columnas a 'clientes'
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS codigo_referido_propio text UNIQUE;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS referido_por_cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

-- 2. Crear función para generar códigos
CREATE OR REPLACE FUNCTION generar_codigo_referido(p_id uuid, p_usuario text, p_nombres text)
RETURNS text AS $$
DECLARE
  base_str text;
  clean_str text;
  final_code text;
BEGIN
  IF p_usuario IS NOT NULL AND TRIM(p_usuario) <> '' THEN
    base_str := p_usuario;
  ELSE
    base_str := COALESCE(p_nombres, 'USER');
  END IF;
  
  clean_str := UPPER(regexp_replace(base_str, '[^a-zA-Z0-9]', '', 'g'));
  
  IF clean_str = '' THEN
    clean_str := 'HULK';
  END IF;
  
  -- Limit clean_str to max 10 chars to prevent excessively long codes
  clean_str := SUBSTRING(clean_str FROM 1 FOR 10);
  
  final_code := clean_str || SUBSTRING(MD5(p_id::text) FROM 1 FOR 4);
  
  RETURN final_code;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Generar códigos para clientes existentes
UPDATE public.clientes 
SET codigo_referido_propio = generar_codigo_referido(id, usuario, nombres) 
WHERE codigo_referido_propio IS NULL;

-- 4. Crear trigger para autogenerar al crear nuevo cliente
CREATE OR REPLACE FUNCTION trigger_generar_codigo_referido()
RETURNS trigger AS $$
BEGIN
  IF NEW.codigo_referido_propio IS NULL THEN
    NEW.codigo_referido_propio := generar_codigo_referido(NEW.id, NEW.usuario, NEW.nombres);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generar_codigo_referido ON public.clientes;
CREATE TRIGGER trg_generar_codigo_referido
BEFORE INSERT ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION trigger_generar_codigo_referido();

-- 5. Tabla de objetivos de referidos
CREATE TABLE IF NOT EXISTS public.referidos_objetivos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    meta_registros_activos integer NOT NULL,
    compras_minimas_usuario integer DEFAULT 1 NOT NULL,
    recompensa_tipo varchar(50) NOT NULL, -- 'saldo_bs', 'saldo_usd', 'producto'
    recompensa_valor numeric NOT NULL, -- Monto o ID de producto
    estado boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- 6. Tabla de recompensas canjeadas por referidos
CREATE TABLE IF NOT EXISTS public.referidos_recompensas_canjeadas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    objetivo_id uuid NOT NULL REFERENCES public.referidos_objetivos(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(cliente_id, objetivo_id) -- Un usuario no puede canjear el mismo objetivo 2 veces
);

-- 7. Habilitar RLS (simplemente policies de lectura)
ALTER TABLE public.referidos_objetivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referidos_recompensas_canjeadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to referidos_objetivos" ON public.referidos_objetivos;
CREATE POLICY "Public read access to referidos_objetivos" ON public.referidos_objetivos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view their own referidos_recompensas_canjeadas" ON public.referidos_recompensas_canjeadas;
CREATE POLICY "Users can view their own referidos_recompensas_canjeadas" ON public.referidos_recompensas_canjeadas FOR SELECT USING (
  cliente_id IN (SELECT id FROM clientes WHERE auth_user_id = auth.uid())
);

-- Los administradores pueden ver, insertar, actualizar todo en objetivos, esto se maneja típicamente por service role o triggers, pero por si acaso damos full a anon (asumiendo que el admin tiene su propio control) o dejamos desactivado en realidad el enforce para admins.
