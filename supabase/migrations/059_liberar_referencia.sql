-- Migration: 059_liberar_referencia.sql
-- Description: RPC para liberar una referencia de la tabla de control si ocurre un error en el cliente durante el checkout.

CREATE OR REPLACE FUNCTION public.liberar_referencia_rpc(
    p_referencia TEXT
) RETURNS void AS $$
BEGIN
    DELETE FROM public.referencias_pagos_control
    WHERE referencia = TRIM(p_referencia);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
