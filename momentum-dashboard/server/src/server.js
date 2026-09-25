import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, "..", "..", "client");
const dataDir = path.join(__dirname, "..", "..", "data");

const app = express();

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/data", express.static(dataDir, { maxAge: "5m" }));
app.use(express.static(clientDir, { maxAge: "1h" }));

const port = process.env.PORT || 4100;
app.listen(port, () => {
  console.log(`Momentum dashboard listening on http://localhost:${port}`);
});
