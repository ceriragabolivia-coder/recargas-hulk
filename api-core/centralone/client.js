/**
 * Cliente para interactuar con la API de Central One.
 * Usa peticiones directas sin proxy.
 */

const BASE_URL = 'https://portal.centraloneglobal.com/api/v1';

/**
 * Petición base interna.
 * 
 * @param {string} endpoint - Endpoint de la API (ej: '/health', '/ping', '/orders')
 * @param {string} method - 'GET' o 'POST'
 * @param {object|null} body - Objeto JSON para el cuerpo de la petición (solo POST)
 * @param {object} customHeaders - Cabeceras adicionales (ej: Idempotency-Key)
 * @returns {Promise<object>} Respuesta del proveedor parseada
 */
async function fetchCentralOne(endpoint, method = 'GET', body = null, customHeaders = {}) {
    // Si no es health, requiere API Key
    let apiKey = null;
    if (endpoint !== '/health') {
        apiKey = process.env.CENTRAL_ONE_API_KEY;
        if (!apiKey) {
            throw new Error('CENTRAL_ONE_API_KEY no configurada en las variables de entorno.');
        }
    }

    const url = `${BASE_URL}${endpoint}`;
    
    const headers = {
        'Accept': 'application/json',
        ...customHeaders
    };

    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const options = {
        method,
        headers
    };

    if (method === 'POST' && body) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    let providerRes;
    try {
        providerRes = await fetch(url, options);
    } catch (error) {
        throw new Error(`Error de red al conectar con Central One: ${error.message}`);
    }

    const text = await providerRes.text();
    let data;

    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        const errorObj = new Error(`Respuesta inválida de Central One (Status: ${providerRes.status}): ${text.substring(0, 200)}`);
        errorObj.status = providerRes.status;
        throw errorObj;
    }

    if (!providerRes.ok) {
        // Formato de error de Central One: { error: { code, message, request_id } }
        let errorMsg = `Error HTTP ${providerRes.status}`;
        let errorCode = 'unknown';
        if (data.error && data.error.message) {
            errorMsg = data.error.message;
            errorCode = data.error.code;
        }

        const errorObj = new Error(errorMsg);
        errorObj.status = providerRes.status;
        errorObj.code = errorCode;
        errorObj.data = data;
        
        // Manejo especial de 429 para poder extraer Retry-After si es necesario
        if (providerRes.status === 429) {
            errorObj.retryAfter = providerRes.headers.get('Retry-After');
        }

        throw errorObj;
    }

    return data;
}

/**
 * Comprueba el estado del servicio (sin autenticar).
 * GET /health
 */
export async function healthCheck() {
    return await fetchCentralOne('/health');
}

/**
 * Comprueba que la llave de API sea válida.
 * GET /ping
 */
export async function ping() {
    return await fetchCentralOne('/ping');
}

/**
 * Obtiene el catálogo de productos habilitados.
 * GET /catalog
 */
export async function getCatalog() {
    return await fetchCentralOne('/catalog');
}

/**
 * Obtiene el saldo disponible de la cuenta.
 * GET /balance
 */
export async function getBalance() {
    return await fetchCentralOne('/balance');
}

/**
 * Crea un pedido nuevo. Gasta saldo y reserva inventario.
 * POST /orders
 * 
 * @param {Array} items - Arreglo de objetos { catalog_item_id, quantity, target_payload? }
 * @param {string} idempotencyKey - Llave única de idempotencia para la transacción
 * @param {string} note - Nota interna para el pedido (opcional)
 */
export async function createOrder(items, idempotencyKey, note = '') {
    if (!idempotencyKey) {
        throw new Error('Idempotency-Key es obligatoria para POST /orders');
    }

    const body = { items };
    if (note) body.note = note;

    return await fetchCentralOne('/orders', 'POST', body, {
        'Idempotency-Key': idempotencyKey
    });
}

/**
 * Consulta el estado de un pedido y sus líneas.
 * GET /orders/{id}
 * 
 * @param {string} id - UUID del pedido
 */
export async function getOrder(id) {
    return await fetchCentralOne(`/orders/${id}`);
}

/**
 * Obtiene los códigos entregados de un pedido completado.
 * Requiere el scope 'codes:read'.
 * GET /orders/{id}/codes
 * 
 * @param {string} id - UUID del pedido
 */
export async function getOrderCodes(id) {
    return await fetchCentralOne(`/orders/${id}/codes`);
}
