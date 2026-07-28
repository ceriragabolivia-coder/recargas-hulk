-- Migration: 149_bloquear_pagos_directos_trigger.sql
-- Description: Trigger para asegurar que no se inserten pedidos con pagos directos si la opción está deshabilitada en la configuración, protegiendo así el backend independientemente de si el cliente manipula el frontend o tiene una pestaña desactualizada.

CREATE OR REPLACE FUNCTION public.check_pago_directo_permitido()
RETURNS TRIGGER AS $$
DECLARE
    v_permitir_pago_directo TEXT;
BEGIN
    -- Solo verificar si se está insertando un pedido con metodo_pago_id (pago directo)
    IF NEW.metodo_pago_id IS NOT NULL THEN
        SELECT (CASE WHEN valor_texto IS NOT NULL THEN valor_texto ELSE valor::TEXT END)
        INTO v_permitir_pago_directo
        FROM public.configuracion
        WHERE clave = 'permitir_pago_directo';

        -- Si la configuración explícitamente dice 'false', rechazamos la operación
        IF v_permitir_pago_directo = 'false' THEN
            RAISE EXCEPTION 'Los pagos directos están temporalmente desactivados. Por favor, recarga la página y utiliza tu Billetera para pagar.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar el trigger si ya existe para evitar errores
DROP TRIGGER IF EXISTS trg_check_pago_directo ON public.pedidos;

-- Solo verificamos en INSERT para no afectar a los administradores que puedan estar
-- actualizando pedidos antiguos que se hicieron cuando la opción estaba habilitada
CREATE TRIGGER trg_check_pago_directo
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.check_pago_directo_permitido();

-- Recargar el esquema
NOTIFY pgrst, 'reload schema';
