import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiHandler from './api/index.js';

// Cargar variables de entorno desde .env.production y luego .env
dotenv.config({ path: '.env.production' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 80; // Usar el puerto 80 por defecto para web si es posible

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rutas de API (redirigidas al enrutador maestro que antes usaba Vercel)
app.all(/^\/api\/.*/, async (req, res) => {
  try {
    // Vercel Serverless Functions esperan req y res compatibles con Express.
    await apiHandler(req, res);
  } catch (error) {
    console.error("❌ Error en el servidor Express al ejecutar la API:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

// Servir archivos estáticos compilados de Vite (Frontend)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Redirigir cualquier otra petición a index.html (Para que React Router funcione)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Iniciar Servidor
app.listen(port, () => {
  console.log(`=========================================`);
  console.log(`🚀 Servidor Hulk iniciado exitosamente!`);
  console.log(`🌐 URL Local: http://localhost:${port}`);
  console.log(`=========================================`);
});
