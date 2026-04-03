-- ============================================================
-- Migración 033: Validación robusta de límites de cupón por usuario
-- Usa pg_advisory_xact_lock para evitar condiciones de carrera
-- cuando múltiples sesiones intentan usar el mismo cupón simultáneamente.
-- ============================================================

-- Función con advisory lock para serializar accesos concurrentes
CREATE OR REPLACE FUNCTION check_cupon_uso_por_usuario()
RETURNS TRIGGER LANGUAGE plpgsql AS $func$
DECLARE
  v_limite integer;
  v_freq varchar(20);
  v_count integer;
  v_last timestamptz;
  v_hours float;
BEGIN
  -- Advisory lock: serializa intentos concurrentes del mismo (cupon, usuario)
  -- Evita race conditions donde dos transacciones leen count=0 simultáneamente
  PERFORM pg_advisory_xact_lock(hashtext(NEW.cupon_id::text || '|' || NEW.cliente_id::text));

  SELECT limite_usos_por_usuario, frecuencia_uso
  INTO v_limite, v_freq
  FROM public.cupones WHERE id = NEW.cupon_id;

  -- Sin restricciones = permitir siempre
  IF v_limite IS NULL AND (v_freq IS NULL OR v_freq = 'ilimitado') THEN
    RETURN NEW;
  END IF;

  -- Contar usos anteriores (ahora es seguro por el advisory lock)
  SELECT COUNT(*), MAX(created_at) INTO v_count, v_last
  FROM public.cupones_usados
  WHERE cupon_id = NEW.cupon_id AND cliente_id = NEW.cliente_id;

  -- Verificar límite total por usuario
  IF v_limite IS NOT NULL AND v_count >= v_limite THEN
    RAISE EXCEPTION 'Limite de usos por usuario alcanzado: %', v_limite;
  END IF;

  -- Verificar cupón de uso único (sin importar cuándo fue el último uso)
  IF v_freq = 'unico' AND v_count > 0 THEN
    RAISE EXCEPTION 'Cupon de uso unico ya fue utilizado por este usuario';
  END IF;

  -- Verificar frecuencias temporales
  IF v_last IS NOT NULL THEN
    v_hours := EXTRACT(EPOCH FROM (NOW() - v_last)) / 3600.0;
    IF v_freq = '24h' AND v_hours < 24 THEN
      RAISE EXCEPTION 'Debes esperar antes de usar este cupon de nuevo';
    ELSIF v_freq = 'semanal' AND v_hours < 168 THEN
      RAISE EXCEPTION 'Debes esperar antes de usar este cupon de nuevo';
    ELSIF v_freq = 'mensual' AND v_hours < 720 THEN
      RAISE EXCEPTION 'Debes esperar antes de usar este cupon de nuevo';
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

-- Trigger BEFORE INSERT en cupones_usados
DROP TRIGGER IF EXISTS trg_check_cupon_uso ON public.cupones_usados;
CREATE TRIGGER trg_check_cupon_uso
  BEFORE INSERT ON public.cupones_usados
  FOR EACH ROW
  EXECUTE FUNCTION check_cupon_uso_por_usuario();
