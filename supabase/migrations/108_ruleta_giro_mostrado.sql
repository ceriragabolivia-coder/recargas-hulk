-- ============================================================
-- Migración 106: Agregar columna 'mostrado' a ruleta_giros
-- para detectar giros cuyo resultado nunca se mostró al usuario
-- (ej. si recargó la página o perdió conexión durante la animación)
-- ============================================================

ALTER TABLE public.ruleta_giros
  ADD COLUMN IF NOT EXISTS mostrado boolean NOT NULL DEFAULT false;

-- Marcar todos los giros históricos como ya mostrados (son anteriores al fix)
UPDATE public.ruleta_giros SET mostrado = true WHERE mostrado = false;

-- RPC para marcar un giro como mostrado al usuario
CREATE OR REPLACE FUNCTION public.marcar_giro_mostrado(p_giro_id uuid, p_cliente_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.ruleta_giros
  SET mostrado = true
  WHERE id = p_giro_id
    AND cliente_id = p_cliente_id; -- solo el propio usuario puede marcar su giro
END;
$$;
