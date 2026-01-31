import express from "express";
import MyMazda from "node-mymazda";

const app = express();
app.use(express.json());

const EMAIL = process.env.MAZDA_EMAIL;
const PASSWORD = process.env.MAZDA_PASSWORD;
const REGION = process.env.MAZDA_REGION || "MNAO";
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/startEngine", async (req, res) => {
  try {
    // simple protection so strangers can't hit your endpoint
    if (!API_KEY || req.header("x-api-key") !== API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { vid } = req.body;
    if (!vid) return res.status(400).json({ error: "Missing vid" });

    if (!EMAIL || !PASSWORD) {
      return res.status(500).json({ error: "Missing MAZDA_EMAIL or MAZDA_PASSWORD" });
    }

    const client = new MyMazda(EMAIL, PASSWORD, REGION);
    await client.login();
    await client.startEngine(vid);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
