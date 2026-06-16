# CLAUDE.md

Este archivo proporciona guía a Claude Code (claude.ai/code) al trabajar con código en este repositorio.

## Qué es esto

"Ceriraga" — una tienda de recargas digitales (créditos de juegos, gift cards, etc.) en español, construida como una SPA de React sobre Vite, respaldada completamente por Supabase (Postgres + Auth + Realtime + RLS), desplegada en Vercel con algunas rutas de API serverless, y empaquetada como app de Android vía Capacitor.

## Comandos

```bash
npm run dev              # Servidor de desarrollo de Vite
npm run build             # Build de producción (genera dist/)
npm run lint               # ESLint (flat config, eslint.config.js)
npm run preview            # Preview de un build de producción

# Android (Capacitor)
npm run mobile:sync        # vite build + cap sync android
npm run mobile:open        # Abre el proyecto Android en Android Studio
npm run mobile:build       # sync + gradlew assembleDebug
npm run mobile:upload      # node scripts/upload-apk.js
```

No hay suite/runner de tests configurado en este repositorio.

Las migraciones de Supabase están en `supabase/migrations/*.sql` y se aplican vía el CLI de Supabase / dashboard contra el proyecto vinculado (ver `supabase/.temp/project-ref`). No hay un script de migración local en `package.json` — las migraciones nuevas se aplican directamente vía Supabase.

## Arquitectura

### La lógica de negocio vive en Postgres, no en React

Casi toda la lógica de negocio no trivial (procesamiento de pedidos, transacciones de billetera, reembolsos, cashback, lógica de premios de la ruleta, flujos de aprobación de roles, etc.) está implementada como **funciones RPC de Postgres** definidas a lo largo de `supabase/migrations/*.sql` (más de 130 archivos de migración secuenciales). Los componentes de React las llaman vía `supabase.rpc('nombre_funcion', {...})` en lugar de hacer escrituras de varios pasos desde el cliente. Al modificar un flujo como checkout, reembolsos o saldo de billetera, hay que esperar encontrar — y probablemente necesitar editar — una RPC en SQL, no solo JS. Lee las migraciones relevantes antes de asumir que la lógica está en `src/`.

Las políticas RLS (Row Level Security) también se definen en estas migraciones y son centrales para el control de acceso — no hay una capa de autorización separada en el código JS.

### Capa de datos/autenticación (`src/context`, `src/hooks`, `src/lib`)

- `src/lib/supabase.js` — instancia única del cliente de Supabase (clave anon, lado navegador). Todo el acceso a la BD desde el cliente pasa por aquí.
- `src/context/AuthContext.jsx` — maneja `user` (usuario de auth de Supabase) y `perfil` (vista combinada de las tablas `perfiles` + `clientes` + `billeteras` para ese usuario). Los roles (`admin`/`administrador`, `negocio`, `empleado`/`trabajador`, `revendedor`, `cliente`) y el `estado` (`aprobado`, `pendiente`, `rechazado`, `suspendido`, `baneado`, `cargando`) controlan el enrutamiento en `App.jsx`. Contiene un caso especial con un email de super-admin hardcodeado, una suscripción realtime sobre la fila `perfiles` del usuario, y una convención de sentinel `__FORCE_LOGOUT__` en `motivo_estado` usada para cerrar sesión remotamente.
- `src/context/CartContext.jsx`, `src/context/WalletContext.jsx`, `src/context/ConfigContext.jsx` — carrito, billetera y configuración global de la app (tabla `configuracion` con patrón clave/valor, vía `clave`/`valor`/`valor_texto`/`owner_id` — filas con `owner_id IS NULL` son valores globales por defecto, las no-nulas son overrides por usuario).
- `src/hooks/useData.jsx` — archivo grande de hooks de obtención de datos (`useJuegos`, `useProductos`, `useVentas`, `useClientes`, `useMetodosPago`, `useCuentasGuardadas`, `useProductoCodigos`, etc.), cada uno envolviendo queries/suscripciones de Supabase para un dominio/tabla específica.

### Enrutamiento y UI basada en roles (`src/App.jsx`)

Un único `App.jsx` de nivel superior (sin archivos de rutas anidados) maneja: la máquina de estados de autenticación (loading → pendiente/rechazado/suspendido/baneado → autenticado), una experiencia pública "Landing" para usuarios no autenticados/anónimos vs. un shell `Layout` autenticado para usuarios logueados, rutas controladas por rol (admin/negocio/empleado vs. cliente normal), tracking de presencia en tiempo real (canal `online-users`), un canal de comandos remotos basado en broadcast (`cmd_<userId>`) que soporta eventos `force_logout` y `config_update`, auto-logout por inactividad con timeouts configurables por rol/usuario, y tracking de actividad de sesión vía heartbeats a la RPC `registrar_actividad_usuario`. Los componentes de página se cargan de forma lazy (`React.lazy`) excepto algunos siempre necesarios (Cart, SupportChat, Landing, FloatingBackground, SystemPopup).

Las rutas son strings en español legibles para humanos (ej. `/Gestion-Productos`, `/Mis-Pedidos`, `/Registro-Ventas`) en lugar de slugs estilo REST; `handleNavigate(page, params)` en `App.jsx` mapea claves cortas internas a estas rutas.

### Integraciones externas de pago/proveedores (`api/`)

Funciones serverless de Vercel, cada una usando la **service role key** de Supabase (evita RLS) en lugar de la clave anon usada del lado cliente:

- `api/tiendagiftven/proxy.js` — proxy genérico passthrough hacia la API del proveedor TiendaGiftVen (evita CORS; reenvía el header `X-API-Key`).
- `api/tiendagiftven/webhook.js` — recibe webhooks de estado de entrega del proveedor, parsea `merchant_ref` con formato `*-ITEM-<id>` para ubicar la fila en `pedido_items`, y actualiza su estado/códigos.
- `api/binance/create-order.js`, `api/binance/webhook.js` — integración con Binance Pay; las órdenes se correlacionan vía `merchantTradeNo = PEDIDO_<pedidoId>`, firmadas con HMAC-SHA512 sobre `timestamp\nnonce\nbody\n`.

`vercel.json` redirige todo lo demás a `index.html` (SPA) y hace proxy de `/api/*` a estas funciones. También hay un rewrite puntual de `/proxy/bloodstrike` a una URL externa de NetEase.

### Scripts sueltos de depuración en la raíz

La raíz del repo tiene muchos scripts de Node sueltos y ad-hoc (`check_*.js`, `debug_*.js`, `test_*.cjs`, `scratch_*.js`, `fix_*.js`, `temp_diff*.txt`, etc.) usados históricamente para sondear la BD de Supabase o depurar problemas específicos directamente contra datos de producción. No forman parte de la app y no están conectados a ningún script de npm — trátalos como descartables, no los tomes como señal arquitectónica, y no extiendas este patrón para nueva depuración (prefiere el dashboard/editor SQL de Supabase o una migración propiamente dicha).

## Convenciones

- Los strings de UI, rutas y la mayoría de identificadores están en español (`pedido`, `venta`, `billetera`, `proveedor`, `revendedor`, etc.) — sigue este patrón al agregar código nuevo.
- La interacción con la base de datos/RPCs es la forma por defecto de implementar una funcionalidad; evita replicar lógica transaccional de varios pasos en JS cuando una RPC puede hacerlo de forma atómica.
- Los cambios de esquema persistentes nuevos van en un archivo numerado nuevo dentro de `supabase/migrations/` (`NNN_descripcion.sql`), continuando desde el número más alto existente — no edites migraciones antiguas en su lugar.
