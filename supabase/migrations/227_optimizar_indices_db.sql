-- Migración 227: Optimizar Índices de Base de Datos para mejorar tiempos de carga (Dashboard y Usuarios)

-- 1. Índices para la tabla 'ventas' (crítico para el Dashboard)
CREATE INDEX IF NOT EXISTS idx_ventas_created_at ON public.ventas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_vendedor_id ON public.ventas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_ventas_owner_id ON public.ventas(owner_id);

-- 2. Índices para las tablas usadas en la vista 'v_clientes_admin' (Gestión de Usuarios)
CREATE INDEX IF NOT EXISTS idx_clientes_auth_user_id ON public.clientes(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_fecha_registro ON public.clientes(fecha_registro DESC);
CREATE INDEX IF NOT EXISTS idx_billeteras_auth_user_id ON public.billeteras(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_usuario_roles_adicionales_usuario_id ON public.usuario_roles_adicionales(usuario_id);

-- 3. Índices para productos (usados frecuentemente en Venta Rápida y Catálogo)
CREATE INDEX IF NOT EXISTS idx_productos_juego_id ON public.productos(juego_id);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON public.productos(activo);

-- 4. Actualizar las estadísticas de la base de datos para que el planeador (Query Planner) use los nuevos índices
ANALYZE public.ventas;
ANALYZE public.clientes;
ANALYZE public.perfiles;
ANALYZE public.billeteras;
ANALYZE public.usuario_roles_adicionales;
ANALYZE public.productos;
