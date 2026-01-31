import express from "express";
import { MyMazdaAPI } from "node-mymazda";

const app = express();
app.use(express.json());

// Env vars you set in Railway
const EMAIL = process.env.MAZDA_EMAIL;
const PASSWORD = process.env.MAZDA_PASSWORD;
const REGION = process.env.MAZDA_REGION || "US"; // adjust if needed
const PORT = process.env.PORT || 3000;

function must(v, name) {
  if (!v) throw new Error(`Missing env var: ${name}`);
}

app.post("/startEngine", async (req, res) => {
  try {
    must(EMAIL, "MAZDA_EMAIL");
    must(PASSWORD, "MAZDA_PASSWORD");

    const { vid } = req.body;
    if (!vid) return res.status(400).json({ error: "Missing vid" });

    const api = new MyMazdaAPI({ email: EMAIL, password: PASSWORD, region: REGION });
    await api.login();

    // Depending on library version, the method name can differ.
    // Common patterns: startEngine(vid) or remoteStart(vid)
    if (typeof api.startEngine === "function") {
      await api.startEngine(vid);
    } else if (typeof api.remoteStart === "function") {
      await api.remoteStart(vid);
    } else {
      return res.status(500).json({ error: "No start method found in node-mymazda" });
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get("/health", (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
