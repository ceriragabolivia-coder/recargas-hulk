-- Migración 232: Memoria multiproveedor para productos

-- 1. Añadir la nueva columna de memoria si no existe
ALTER TABLE public.productos 
ADD COLUMN IF NOT EXISTS api_provider_ids JSONB DEFAULT '{}'::jsonb;

-- 2. Poblar la memoria inicial usando el estado actual de la base de datos
UPDATE public.productos
SET api_provider_ids = jsonb_build_object(
    COALESCE(
        NULLIF(TRIM((SELECT api_provider::text FROM public.juegos WHERE id = productos.juego_id)), ''), 
        'tiendagiftven'
    ), 
    proveedor_api_id
)
WHERE proveedor_api_id IS NOT NULL AND TRIM(proveedor_api_id::text) != '';

-- 3. Crear el Trigger para productos: Guardar en memoria cuando cambie el ID
CREATE OR REPLACE FUNCTION public.update_api_provider_ids() RETURNS trigger AS $$
DECLARE
    v_provider text;
BEGIN
    IF NEW.proveedor_api_id IS NOT NULL AND TRIM(NEW.proveedor_api_id::text) != '' THEN
        -- Obtener el proveedor efectivo desde la tabla juegos
        SELECT api_provider INTO v_provider FROM public.juegos WHERE id = NEW.juego_id;
        
        v_provider := COALESCE(NULLIF(TRIM(v_provider), ''), 'tiendagiftven');
        
        -- Actualizar el diccionario JSONB en la memoria del producto
        NEW.api_provider_ids := COALESCE(NEW.api_provider_ids, '{}'::jsonb) || jsonb_build_object(v_provider, NEW.proveedor_api_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_api_provider_ids ON public.productos;
CREATE TRIGGER trg_update_api_provider_ids
BEFORE INSERT OR UPDATE OF proveedor_api_id
ON public.productos
FOR EACH ROW
EXECUTE FUNCTION public.update_api_provider_ids();

-- 4. Crear el Trigger para juegos: Sincronizar los productos cuando cambie el proveedor principal
CREATE OR REPLACE FUNCTION public.update_productos_from_memory() RETURNS trigger AS $$
BEGIN
    IF NEW.api_provider IS DISTINCT FROM OLD.api_provider THEN
        -- Actualizar los productos que pertenecen a este juego
        UPDATE public.productos
        SET proveedor_api_id = (api_provider_ids->>NEW.api_provider)
        WHERE juego_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_productos_from_memory ON public.juegos;
CREATE TRIGGER trg_update_productos_from_memory
AFTER UPDATE OF api_provider
ON public.juegos
FOR EACH ROW
EXECUTE FUNCTION public.update_productos_from_memory();
