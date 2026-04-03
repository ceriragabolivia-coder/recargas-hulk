-- ============================================================
-- Migración 033: Constraint de unicidad para cupones de tipo 'unico'
-- Previene que un mismo usuario use un cupón más veces de lo permitido
-- a nivel de base de datos (defensa contra race conditions del frontend).
-- ============================================================

-- 1. Función para verificar el límite de usos por usuario antes de insertar
CREATE OR REPLACE FUNCTION check_cupon_uso_por_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_limite_usos_por_usuario INTEGER;
  v_frecuencia_uso VARCHAR(20);
  v_usos_actuales INTEGER;
  v_ultimo_uso TIMESTAMPTZ;
  v_diff_horas FLOAT;
BEGIN
  -- Obtener configuración del cupón
  SELECT limite_usos_por_usuario, frecuencia_uso
  INTO v_limite_usos_por_usuario, v_frecuencia_uso
  FROM public.cupones
  WHERE id = NEW.cupon_id;

  -- Si no hay límite por usuario, permitir
  IF v_limite_usos_por_usuario IS NULL AND (v_frecuencia_uso IS NULL OR v_frecuencia_uso = 'ilimitado') THEN
    RETURN NEW;
  END IF;

  -- Contar usos anteriores del mismo cliente para este cupón
  SELECT COUNT(*), MAX(created_at)
  INTO v_usos_actuales, v_ultimo_uso
  FROM public.cupones_usados
  WHERE cupon_id = NEW.cupon_id AND cliente_id = NEW.cliente_id;

  -- Verificar límite total por usuario
  IF v_limite_usos_por_usuario IS NOT NULL AND v_usos_actuales >= v_limite_usos_por_usuario THEN
    RAISE EXCEPTION 'CUPON_LIMITE_USUARIO: Has alcanzado el límite máximo de % usos para este cupón.', v_limite_usos_por_usuario;
  END IF;

  -- Verificar frecuencia de uso
  IF v_ultimo_uso IS NOT NULL THEN
    v_diff_horas := EXTRACT(EPOCH FROM (NOW() - v_ultimo_uso)) / 3600.0;

    IF v_frecuencia_uso = 'unico' AND v_usos_actuales > 0 THEN
      RAISE EXCEPTION 'CUPON_FRECUENCIA: Ya utilizaste este cupón y solo puede usarse una vez.';
    ELSIF v_frecuencia_uso = '24h' AND v_diff_horas < 24 THEN
      RAISE EXCEPTION 'CUPON_FRECUENCIA: Debes esperar % horas más para volver a usar este cupón.', CEIL(24 - v_diff_horas);
    ELSIF v_frecuencia_uso = 'semanal' AND v_diff_horas < 168 THEN
      RAISE EXCEPTION 'CUPON_FRECUENCIA: Debes esperar % horas más para volver a usar este cupón.', CEIL(168 - v_diff_horas);
    ELSIF v_frecuencia_uso = 'mensual' AND v_diff_horas < 720 THEN
      RAISE EXCEPTION 'CUPON_FRECUENCIA: Debes esperar % días más para volver a usar este cupón.', CEIL((720 - v_diff_horas) / 24);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Trigger que se dispara ANTES de cada inserción en cupones_usados
DROP TRIGGER IF EXISTS trg_check_cupon_uso_por_usuario ON public.cupones_usados;
CREATE TRIGGER trg_check_cupon_uso_por_usuario
  BEFORE INSERT ON public.cupones_usados
  FOR EACH ROW
  EXECUTE FUNCTION check_cupon_uso_por_usuario();
