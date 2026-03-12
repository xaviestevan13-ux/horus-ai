import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("hp_care.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    country TEXT,
    role TEXT DEFAULT 'user'
  );
`);

// Ensure columns exist if table was created before they were added
try { db.exec("ALTER TABLE users ADD COLUMN country TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'"); } catch (e) {}
try { db.exec("ALTER TABLE inspections ADD COLUMN inspection_type TEXT DEFAULT 'laptop'"); } catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    model TEXT NOT NULL,
    inspection_type TEXT DEFAULT 'laptop',
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    results TEXT NOT NULL,
    summary TEXT NOT NULL,
    overall_health TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_id INTEGER NOT NULL,
    user_id INTEGER,
    is_correct BOOLEAN NOT NULL,
    comment TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inspection_id) REFERENCES inspections (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    model TEXT NOT NULL,
    serial_number TEXT,
    purchase_date DATE,
    device_type TEXT DEFAULT 'laptop',
    status TEXT DEFAULT 'online',
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Auth Routes
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, name, country } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const role = (email.endsWith('@hp.com') || email === 'roger.torrents@estudiantat.upc.edu') ? 'technician' : 'user';
    
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (email, password, name, country, role) VALUES (?, ?, ?, ?, ?)");
      const result = stmt.run(email, hashedPassword, name, country, role);
      res.json({ id: result.lastInsertRowid, email, name, country, role });
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed: users.email')) {
        return res.status(400).json({ error: "Email already exists" });
      }
      res.status(500).json({ error: "Internal server error during signup" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    try {
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as { id: number, email: string, password: string, name: string, country: string, role: string } | undefined;
      
      if (user && await bcrypt.compare(password, user.password)) {
        res.json({ id: user.id, email: user.email, name: user.name, country: user.country, role: user.role });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Internal server error during login" });
    }
  });

  // Inspection Routes
  app.post("/api/inspections", (req, res) => {
    const { user_id, model, results, summary, overall_health, inspection_type } = req.body;
    if (!user_id || !model || !results) {
      return res.status(400).json({ error: "Missing required inspection data" });
    }
    try {
      const stmt = db.prepare("INSERT INTO inspections (user_id, model, results, summary, overall_health, inspection_type) VALUES (?, ?, ?, ?, ?, ?)");
      const result = stmt.run(user_id, model, JSON.stringify(results), summary, overall_health, inspection_type || 'laptop');
      res.json({ id: result.lastInsertRowid });
    } catch (err: any) {
      console.error("Error saving inspection:", err);
      res.status(500).json({ error: "Failed to save inspection record" });
    }
  });

  app.get("/api/inspections/:userId", (req, res) => {
    const { userId } = req.params;
    const inspections = db.prepare("SELECT * FROM inspections WHERE user_id = ? ORDER BY date DESC").all(userId);
    res.json(inspections.map((i: any) => ({ ...i, results: JSON.parse(i.results) })));
  });

  app.delete("/api/inspections/:id", (req, res) => {
    const { id } = req.params;
    try {
      const stmt = db.prepare("DELETE FROM inspections WHERE id = ?");
      stmt.run(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting inspection:", err);
      res.status(500).json({ error: "Failed to delete inspection" });
    }
  });

  app.delete("/api/fleet/:userId/:model", (req, res) => {
    const { userId, model } = req.params;
    try {
      const stmt = db.prepare("DELETE FROM inspections WHERE user_id = ? AND model = ?");
      stmt.run(userId, model);
      // Also delete from devices table if it exists there
      db.prepare("DELETE FROM devices WHERE user_id = ? AND model = ?").run(userId, model);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting from fleet:", err);
      res.status(500).json({ error: "Failed to remove device from fleet" });
    }
  });

  // Device Routes
  app.post("/api/devices", (req, res) => {
    const { user_id, model, serial_number, purchase_date, device_type } = req.body;
    if (!user_id || !model || !device_type) {
      return res.status(400).json({ error: "Missing required device data" });
    }
    try {
      const stmt = db.prepare("INSERT INTO devices (user_id, model, serial_number, purchase_date, device_type) VALUES (?, ?, ?, ?, ?)");
      const result = stmt.run(user_id, model, serial_number || '', purchase_date || '', device_type);
      res.json({ id: result.lastInsertRowid });
    } catch (err: any) {
      console.error("Error registering device:", err);
      res.status(500).json({ error: "Failed to register device" });
    }
  });

  app.get("/api/devices/:userId", (req, res) => {
    const { userId } = req.params;
    try {
      const devices = db.prepare("SELECT * FROM devices WHERE user_id = ?").all(userId);
      res.json(devices);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Technician Stats Route
  app.get("/api/technician/stats", (req, res) => {
    try {
      const stats = db.prepare(`
        SELECT i.model, i.results, u.country
        FROM inspections i
        LEFT JOIN users u ON i.user_id = u.id
        WHERE i.inspection_type = 'laptop'
      `).all();
      
      const processedStats = stats.map((s: any) => ({
        ...s,
        results: JSON.parse(s.results)
      }));
      
      res.json(processedStats);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Feedback Routes
  app.post("/api/feedback", (req, res) => {
    const { inspection_id, user_id, is_correct, comment } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO feedback (inspection_id, user_id, is_correct, comment) VALUES (?, ?, ?, ?)");
      const result = stmt.run(inspection_id, user_id, is_correct ? 1 : 0, comment);
      res.json({ id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/feedback/recent", (req, res) => {
    try {
      const feedback = db.prepare(`
        SELECT f.*, i.model, i.results, i.summary 
        FROM feedback f 
        JOIN inspections i ON f.inspection_id = i.id 
        ORDER BY f.date DESC 
        LIMIT 10
      `).all();
      res.json(feedback);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
