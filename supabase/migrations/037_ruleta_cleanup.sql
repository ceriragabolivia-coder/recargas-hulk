-- ============================================================
-- Migración 037: Limpieza de descuentos automáticos en perfiles
-- ============================================================

-- Los descuentos de la ruleta antes se guardaban en la columna 
-- 'porcentaje_descuento' de la tabla 'perfiles'. 
-- Para activar el nuevo sistema manual (cupones), debemos limpiar 
-- esa columna para usuarios que NO son revendedores oficiales.

UPDATE public.perfiles 
SET porcentaje_descuento = 0 
WHERE LOWER(rol) != 'revendedor';

-- Nota: Si un usuario era revendedor y ganó un descuento, se mantendrá
-- su descuento de revendedor base. Los descuentos de ruleta ahora
-- irán por la tabla ruleta_descuentos_pendientes.
