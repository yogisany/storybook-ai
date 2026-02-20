import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("storybook.db");

// Supabase Admin Client (Lazy initialization to avoid crash if env vars are missing at startup)
let supabaseAdmin: any = null;

const getSupabaseAdmin = () => {
  if (supabaseAdmin) return supabaseAdmin;
  
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error("Missing Supabase Admin configuration:", { hasUrl: !!url, hasKey: !!key });
    return null;
  }
  
  supabaseAdmin = createClient(url, key);
  return supabaseAdmin;
};

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    credits INTEGER DEFAULT 10
  );

  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    userId TEXT,
    title TEXT,
    theme TEXT,
    targetAge TEXT,
    moral TEXT,
    coverUrl TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    bookId TEXT,
    pageNumber INTEGER,
    content TEXT,
    illustrationUrl TEXT,
    narrationUrl TEXT,
    FOREIGN KEY(bookId) REFERENCES books(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  const apiRouter = express.Router();

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy for Freepik Image Generation (to avoid CORS)
  apiRouter.all("/generate-image", async (req, res) => {
    console.log(`[Freepik Proxy] Request received: ${req.method} ${req.url}`);
    
    if (req.method === "GET") {
      return res.json({ message: "Freepik Proxy is active. Use POST to generate images." });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { prompt, apiKey } = req.body;
    
    if (!apiKey) {
      console.error("[Freepik Proxy] Missing API Key");
      return res.status(400).json({ error: "Freepik API Key is required" });
    }

    try {
      console.log(`[Freepik Proxy] Calling Freepik API for prompt: ${prompt?.substring(0, 50)}...`);
      const freepikResponse = await fetch("https://api.freepik.com/v1/ai/text-to-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "x-freepik-api-key": apiKey
        },
        body: JSON.stringify({
          prompt: prompt,
          num_images: 1,
          image: {
            size: "square_1024"
          },
          styling: {
            style: "cartoon"
          }
        })
      });

      console.log(`[Freepik Proxy] Freepik API status: ${freepikResponse.status}`);

      if (!freepikResponse.ok) {
        const errorData = await freepikResponse.json().catch(() => ({ message: "Unknown error from Freepik" }));
        console.error("[Freepik Proxy] Freepik Error:", errorData);
        return res.status(freepikResponse.status).json(errorData);
      }

      const data = await freepikResponse.json();
      console.log("[Freepik Proxy] Success!");
      res.json(data);
    } catch (error: any) {
      console.error("[Freepik Proxy] Critical Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Admin: Create User without Sign Up
  apiRouter.post("/admin/create-user", async (req, res) => {
    console.log("Received admin user creation request:", req.body.email);
    const { email, password, name, role } = req.body;
    
    const adminClient = getSupabaseAdmin();
    if (!adminClient) {
      console.error("Failed to initialize Supabase Admin client. Check environment variables.");
      return res.status(500).json({ 
        error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL is missing." 
      });
    }

    try {
      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          role: role || 'admin'
        }
      });

      if (authError) {
        console.error("Supabase Auth Error:", authError);
        throw authError;
      }

      // 2. Create profile in profiles table
      const { error: profileError } = await adminClient
        .from('profiles')
        .insert({
          id: authData.user.id,
          full_name: name,
          email: email,
          role: role || 'admin'
        });

      if (profileError) {
        console.error("Supabase Profile Error:", profileError);
        throw profileError;
      }

      console.log("Admin user created successfully:", email);
      res.json({ success: true, user: authData.user });
    } catch (error: any) {
      console.error("Admin user creation error detail:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // User Routes
  apiRouter.post("/users", (req, res) => {
    const { id, email, name } = req.body;
    try {
      const stmt = db.prepare("INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)");
      stmt.run(id, email, name);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Book Routes
  apiRouter.post("/books", (req, res) => {
    const { id, userId, title, theme, targetAge, moral, coverUrl } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO books (id, userId, title, theme, targetAge, moral, coverUrl) VALUES (?, ?, ?, ?, ?, ?, ?)");
      stmt.run(id, userId, title, theme, targetAge, moral, coverUrl);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  apiRouter.get("/books/:userId", (req, res) => {
    try {
      const books = db.prepare("SELECT * FROM books WHERE userId = ? ORDER BY createdAt DESC").all(req.params.userId);
      res.json(books);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  apiRouter.post("/pages", (req, res) => {
    const { id, bookId, pageNumber, content, illustrationUrl } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO pages (id, bookId, pageNumber, content, illustrationUrl) VALUES (?, ?, ?, ?, ?)");
      stmt.run(id, bookId, pageNumber, content, illustrationUrl);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  apiRouter.get("/books/:bookId/pages", (req, res) => {
    try {
      const pages = db.prepare("SELECT * FROM pages WHERE bookId = ? ORDER BY pageNumber ASC").all(req.params.bookId);
      res.json(pages);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Mount API Router
  app.use("/api", apiRouter);

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
