const express = require("express");
const path = require("path");

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;

  app.use(express.json());

  // Localizamos la carpeta dist de forma absoluta
  const distPath = path.resolve(__dirname, "dist");

  // Servimos los archivos estáticos
  app.use(express.static(distPath));

  // Ruta de salud para Google Cloud
  app.get("/health", (req, res) => res.send("OK"));

  // Todo lo demás sirve el index.html
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log("Servidor Horus AI operando en puerto " + PORT);
  });
}

startServer().catch((err) => console.error(err));
