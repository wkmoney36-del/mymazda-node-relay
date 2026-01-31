import express from "express";
import * as MyMazdaPkg from "node-mymazda";

const app = express();
app.use(express.json());

const EMAIL = process.env.MAZDA_EMAIL;
const PASSWORD = process.env.MAZDA_PASSWORD;
const REGION = process.env.MAZDA_REGION || "MNAO";
const PORT = process.env.PORT || 3000;

// ✅ Works whether node-mymazda exports default, named, or module.exports
const MyMazda =
  MyMazdaPkg.default ??
  MyMazdaPkg.MyMazda ??
  MyMazdaPkg;

app.post("/startEngine", async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== process.env.API_KEY)
      return res.status(401).json({ error: "Unauthorized" });

    const { vid } = req.body;
    if (!vid) return res.status(400).json({ error: "Missing vid" });

    if (!EMAIL || !PASSWORD) {
      return res.status(500).json({ error: "Missing MAZDA_EMAIL or MAZDA_PASSWORD env vars" });
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
