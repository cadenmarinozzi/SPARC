import chokidar from "chokidar";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, "..");
const shadersDir = path.join(projectRoot, "shaders");

const app = express();
const PORT = 3000;

app.use(express.static(projectRoot));

const server = app.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Client connected for live reload");
});

const watcher = chokidar.watch(shadersDir, {
  ignoreInitial: true,
});

watcher.on("change", (filePath) => {
  console.log(`File changed: ${filePath}`);

  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send("reload");
  });
});
