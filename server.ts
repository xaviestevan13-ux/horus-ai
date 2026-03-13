import express, { Request, Response } from 'express';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// La carpeta 'dist' es donde Vite guarda la web construida
const distPath = path.resolve(process.cwd(), 'dist');

// Servir archivos estáticos
app.use(express.static(distPath));

// Ruta de salud
app.get('/health', (_req: Request, res: Response) => {
  res.send('OK');
});

// Captura todas las demás rutas y sirve el index.html
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
