import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  
  // Google Cloud Run usa el puerto 8080 por defecto
  const PORT = process.env.PORT || "8080";

  app.use(express.json());

  // Definimos la ruta de la carpeta 'dist' de forma absoluta
  const distPath = path.resolve(process.cwd(), 'dist');

  // 1. Servir archivos estáticos (js, css, imágenes)
  app.use(express.static(distPath));

  // 2. Ruta para la API (si tienes alguna en el futuro la pones aquí)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // 3. CUALQUIER otra ruta sirve el index.html (Vital para aplicaciones SPA)
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        res.status(500).send("Error: La carpeta 'dist' o el 'index.html' no existen en el servidor.");
      }
    });
  });

  // Escuchar en 0.0.0.0 (obligatorio para Docker/Cloud Run)
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`🚀 Horus AI funcionando en el puerto ${PORT}`);
    console.log(`📁 Buscando archivos en: ${distPath}`);
  });
}

startServer().catch((err) => {
  console.error("Error al arrancar el servidor:", err);
});
