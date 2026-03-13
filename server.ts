import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || "8080";

  app.use(express.json());

  // Localizamos la carpeta dist
  const distPath = path.resolve(process.cwd(), 'dist');

  // Servimos los archivos estáticos
  app.use(express.static(distPath));

  // Ruta de salud para Google Cloud
  app.get("/health", (_req, res) => res.send("OK"));

  // Todo lo demás sirve el index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Servidor en puerto ${PORT}`);
  });
}

startServer().catch(console.error);
