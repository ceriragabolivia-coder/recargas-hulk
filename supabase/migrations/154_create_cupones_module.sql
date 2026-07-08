-- migration cupones
CREATE TABLE IF NOT EXISTS public.cupones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    porcentaje_descuento NUMERIC NOT NULL CHECK (porcentaje_descuento > 0 AND porcentaje_descuento <= 100),
    max_usos_global INT DEFAULT NULL,
    max_usos_usuario INT DEFAULT 1,
    usos_actuales INT DEFAULT 0,
    fecha_inicio TIMESTAMPTZ,
    fecha_fin TIMESTAMPTZ,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read cupones" ON public.cupones FOR SELECT USING (activo = true);
CREATE POLICY "Admin full access cupones" ON public.cupones FOR ALL USING (
  EXISTS (SELECT 1 FROM perfiles WHERE perfiles.id = auth.uid() AND (perfiles.rol = 'admin' OR perfiles.rol = 'administrador'))
);

CREATE TABLE IF NOT EXISTS public.cupones_usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cupon_id UUID REFERENCES public.cupones(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    usos INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cupon_id, usuario_id)
);

ALTER TABLE public.cupones_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own cupones_usuarios" ON public.cupones_usuarios FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "Admin full access cupones_usuarios" ON public.cupones_usuarios FOR ALL USING (
  EXISTS (SELECT 1 FROM perfiles WHERE perfiles.id = auth.uid() AND (perfiles.rol = 'admin' OR perfiles.rol = 'administrador'))
);

-- Alter pedidos (safe execution)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='cupon_id') THEN
        ALTER TABLE public.pedidos 
        ADD COLUMN cupon_id UUID REFERENCES public.cupones(id) ON DELETE SET NULL,
        ADD COLUMN descuento_cupon_usd NUMERIC DEFAULT 0,
        ADD COLUMN descuento_cupon_bs NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_pedidos_cupon_before_insert ON public.pedidos;
DROP FUNCTION IF EXISTS trigger_validar_y_usar_cupon();

-- Trigger for cupon logic
CREATE OR REPLACE FUNCTION trigger_validar_y_usar_cupon()
RETURNS TRIGGER AS $$
DECLARE
    v_cupon RECORD;
    v_uso_usuario INT;
BEGIN
    IF NEW.cupon_id IS NOT NULL THEN
        -- Bloquear el cupón para lectura concurrente
        SELECT * INTO v_cupon FROM public.cupones WHERE id = NEW.cupon_id FOR UPDATE;
        
        IF NOT FOUND OR NOT v_cupon.activo THEN
            RAISE EXCEPTION 'Cupón inválido o inactivo';
        END IF;

        IF v_cupon.fecha_inicio IS NOT NULL AND NOW() < v_cupon.fecha_inicio THEN
            RAISE EXCEPTION 'El cupón aún no es válido';
        END IF;

        IF v_cupon.fecha_fin IS NOT NULL AND NOW() > v_cupon.fecha_fin THEN
            RAISE EXCEPTION 'El cupón ha expirado';
        END IF;

        IF v_cupon.max_usos_global IS NOT NULL AND v_cupon.usos_actuales >= v_cupon.max_usos_global THEN
            RAISE EXCEPTION 'El cupón ha superado su límite de usos global';
        END IF;

        -- Validar uso por usuario
        IF v_cupon.max_usos_usuario IS NOT NULL THEN
            SELECT usos INTO v_uso_usuario FROM public.cupones_usuarios WHERE cupon_id = NEW.cupon_id AND usuario_id = NEW.cliente_id FOR UPDATE;
            IF FOUND AND v_uso_usuario >= v_cupon.max_usos_usuario THEN
                RAISE EXCEPTION 'Has superado el límite de usos para este cupón';
            END IF;
        END IF;

        -- Actualizar usos
        UPDATE public.cupones SET usos_actuales = usos_actuales + 1 WHERE id = NEW.cupon_id;

        IF v_uso_usuario IS NULL THEN
            INSERT INTO public.cupones_usuarios (cupon_id, usuario_id, usos) VALUES (NEW.cupon_id, NEW.cliente_id, 1);
        ELSE
            UPDATE public.cupones_usuarios SET usos = usos + 1 WHERE cupon_id = NEW.cupon_id AND usuario_id = NEW.cliente_id;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pedidos_cupon_before_insert
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION trigger_validar_y_usar_cupon();

-- RPC para validar cupon desde frontend
CREATE OR REPLACE FUNCTION validar_cupon_rpc(p_codigo TEXT, p_usuario_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_cupon RECORD;
    v_uso_usuario INT;
BEGIN
    SELECT * INTO v_cupon FROM public.cupones WHERE codigo = p_codigo;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón no existe.');
    END IF;

    IF NOT v_cupon.activo THEN
        RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón está inactivo.');
    END IF;

    IF v_cupon.fecha_inicio IS NOT NULL AND NOW() < v_cupon.fecha_inicio THEN
        RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón aún no está disponible.');
    END IF;

    IF v_cupon.fecha_fin IS NOT NULL AND NOW() > v_cupon.fecha_fin THEN
        RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón ha expirado.');
    END IF;

    IF v_cupon.max_usos_global IS NOT NULL AND v_cupon.usos_actuales >= v_cupon.max_usos_global THEN
        RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón ha alcanzado su límite máximo de usos global.');
    END IF;

    IF v_cupon.max_usos_usuario IS NOT NULL THEN
        SELECT usos INTO v_uso_usuario FROM public.cupones_usuarios WHERE cupon_id = v_cupon.id AND usuario_id = p_usuario_id;
        IF FOUND AND v_uso_usuario >= v_cupon.max_usos_usuario THEN
            RETURN jsonb_build_object('valido', false, 'mensaje', 'Ya has utilizado este cupón el número máximo de veces.');
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'valido', true, 
        'id', v_cupon.id, 
        'codigo', v_cupon.codigo, 
        'porcentaje_descuento', v_cupon.porcentaje_descuento
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC para asignar un cupón directamente a un usuario y mandarle notificación
CREATE OR REPLACE FUNCTION asignar_cupon_usuario_rpc(p_cupon_id UUID, p_usuario_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_cupon RECORD;
BEGIN
    SELECT * INTO v_cupon FROM public.cupones WHERE id = p_cupon_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'El cupón no existe.');
    END IF;
    
    -- Insert or ignore
    INSERT INTO public.cupones_usuarios (cupon_id, usuario_id, usos)
    VALUES (p_cupon_id, p_usuario_id, 0)
    ON CONFLICT (cupon_id, usuario_id) DO NOTHING;

    -- Enviar notificacion push
    -- Se usa notificaciones_usuarios
    INSERT INTO public.notificaciones_usuarios (user_id, titulo, mensaje)
    VALUES (
        p_usuario_id,
        '¡Te han regalado un cupón! 🎟️',
        'Has recibido un cupón de ' || v_cupon.porcentaje_descuento || '% de descuento. Usa el código: ' || v_cupon.codigo || ' en tu próxima compra.'
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
