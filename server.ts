import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  // Google Cloud Run requiere el puerto 8080 por defecto
  const PORT = process.env.PORT || "8080";

  app.use(express.json());

  const isProduction = process.env.NODE_ENV === "production";
  const distPath = path.join(process.cwd(), 'dist');
 
  if (isProduction) {
    // En producción, servimos los archivos estáticos de la carpeta 'dist'
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // En desarrollo, usamos el middleware de Vite
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // Escuchar en 0.0.0.0 es obligatorio para despliegues en la nube
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Servidor listo en puerto ${PORT}`);
  });
}

startServer();
