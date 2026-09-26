package com.recargashulk.bdvscraper // Cambia esto si tu paquete se llama diferente

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import org.json.JSONArray
import android.content.Context
import java.io.IOException

class BdvNotificationListener : NotificationListenerService() {

    // ==========================================
    // CONFIGURACIÓN: CAMBIA ESTOS DATOS
    // ==========================================
    private val webhookUrl = "https://recargashulk.com/api/pagos/webhook" // URL de tu backend
    private val secretToken = "BdvSecret_Hulk_2026!" // Tu contraseña secreta
    private val bancoPackage = "com.bancodevenezuela.bdvdigital" // Paquete oficial del BDV
    // ==========================================

    private val client = OkHttpClient()
    private val JSON = "application/json; charset=utf-8".toMediaType()

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName

        val extras = sbn.notification.extras
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val bigText = extras.getCharSequence("android.bigText")?.toString() ?: ""
        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        
        // Unimos todos los campos y reemplazamos saltos de línea por espacios
        // para asegurar que las expresiones regulares funcionen correctamente
        val fullMessage = "$title - $text - $bigText".replace("\n", " ").replace("\r", " ")

        val esAppOficial = packageName.contains("venezuela", ignoreCase = true) || packageName.contains("bdv", ignoreCase = true)
        val esSmsBdv = title.contains("BDV", ignoreCase = true) || title.contains("Banco de Venezuela", ignoreCase = true) || 
                       fullMessage.contains("BDV", ignoreCase = true) || fullMessage.contains("Banco de Venezuela", ignoreCase = true)

        if (esAppOficial || esSmsBdv) {
            val timestamp = sbn.postTime

            Log.d("BdvScraper", "Notificación recibida BDV: $fullMessage (Paquete: $packageName)")

            val datos = extraerDatosPago(fullMessage)

            if (datos["referencia"] != null && datos["monto"] != null) {
                // Parse timestamp to ISO-8601 string or send milliseconds
                val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
                val fecha = sdf.format(java.util.Date(timestamp))

                datos["fecha"] = fecha
                datos["texto_original"] = fullMessage
                datos["fuente"] = "notification"

                enviarAlServidor(datos)
                guardarEnHistorial(datos)
            } else {
                Log.d("BdvScraper", "No se extrajo referencia o monto de la notificación. Ref: ${datos["referencia"]}, Monto: ${datos["monto"]}")
            }
        }
    }

    private fun guardarEnHistorial(datos: Map<String, String?>) {
        try {
            val prefs = applicationContext.getSharedPreferences("bdv_historial", Context.MODE_PRIVATE)
            val historyStr = prefs.getString("pagos", "[]") ?: "[]"
            val jsonArray = JSONArray(historyStr)

            val nuevoPago = JSONObject()
            datos.forEach { (key, value) ->
                if (value != null) nuevoPago.put(key, value)
            }

            // Crear un nuevo arreglo para poner el más reciente primero
            val nuevoArray = JSONArray()
            nuevoArray.put(nuevoPago)
            
            // Agregar los anteriores, hasta un máximo de 50
            val limit = if (jsonArray.length() < 50) jsonArray.length() else 49
            for (i in 0 until limit) {
                nuevoArray.put(jsonArray.get(i))
            }

            prefs.edit().putString("pagos", nuevoArray.toString()).apply()
            Log.d("BdvScraper", "Historial actualizado. Pagos guardados: ${nuevoArray.length()}")
        } catch (e: Exception) {
            Log.e("BdvScraper", "Error guardando en historial", e)
        }
    }

    private fun extraerDatosPago(texto: String): MutableMap<String, String?> {
        val datos = mutableMapOf<String, String?>(
            "referencia" to null,
            "monto" to null,
            "telefono" to null
        )

        try {
            // 1. Extraer Referencia
            // Buscamos palabras clave como "Ref", "ref", "operación", "operacion" seguido de dígitos.
            val refRegex = Regex("(?:[Rr]ef(?:erencia)?|[Oo]peraci[oó]n)[.:# ]*?(\\d{6,})", RegexOption.IGNORE_CASE)
            val refMatch = refRegex.find(texto)
            if (refMatch != null) {
                val fullRef = refMatch.groupValues[1]
                datos["referencia"] = if (fullRef.length >= 6) fullRef.takeLast(6) else fullRef
            } else {
                // Fallback referencia: Buscar secuencias de 6+ números.
                val numRegex = Regex("(\\d{6,})")
                val matches = numRegex.findAll(texto).toList()
                for (match in matches.reversed()) {
                    val fullRef = match.groupValues[1]
                    // Si no empieza con 04 o 02 (evitando números de teléfono), lo tomamos.
                    if (!fullRef.startsWith("04") && !fullRef.startsWith("02")) {
                        datos["referencia"] = fullRef.takeLast(6)
                        break
                    }
                }
            }

            // 2. Extraer Monto
            // Misma lógica robusta que BdvAccessibilityService
            var montoMatch = Regex("(\\d{1,3}(?:[.,]\\d{3})*[.,]\\d{2})\\s*(?:Bs\\.?|VED)").find(texto)
            if (montoMatch == null) {
                montoMatch = Regex("(?:Bs\\.?|VED)\\s*(\\d{1,3}(?:[.,]\\d{3})*[.,]\\d{2})").find(texto)
            }
            if (montoMatch == null) {
                montoMatch = Regex("(\\d{1,3}(?:\\.\\d{3})*,\\d{2})").find(texto)
            }
            if (montoMatch != null) {
                val raw = montoMatch.groupValues[1]
                val normalizado = if (raw.contains(',')) {
                    raw.replace(".", "").replace(",", ".")
                } else {
                    raw
                }
                datos["monto"] = normalizado
            }

            // 3. Extraer Teléfono (Soporta formatos con guión como 0412-1234567 o sin guión)
            val telRegex = Regex("(04\\d{2})[- \\.]?(\\d{7})")
            val telMatch = telRegex.find(texto)
            if (telMatch != null) {
                // Unimos el código de operadora con el número sin guiones
                datos["telefono"] = telMatch.groupValues[1] + telMatch.groupValues[2]
            }

        } catch (e: Exception) {
            Log.e("BdvScraper", "Error extrayendo datos", e)
        }

        return datos
    }


    private fun enviarAlServidor(datos: Map<String, String?>) {
        val jsonObj = JSONObject()
        datos.forEach { (key, value) ->
            if (value != null) {
                jsonObj.put(key, value)
            }
        }
        jsonObj.put("banco_origen", "BDV")
        jsonObj.put("banco_destino", "BDV")

        val body = jsonObj.toString().toRequestBody(JSON)

        val request = Request.Builder()
            .url(webhookUrl)
            .post(body)
            .addHeader("Authorization", "Bearer $secretToken")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("BdvScraper", "Fallo enviando al servidor", e)
            }

            override fun onResponse(call: Call, response: Response) {
                Log.d("BdvScraper", "Respuesta del servidor: ${response.code} - ${response.body?.string()}")
                response.close()
            }
        })
    }
}
