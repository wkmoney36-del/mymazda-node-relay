import express from "express";
import MyMazda from "node-mymazda";

const app = express();
app.use(express.json());

const EMAIL = process.env.MAZDA_EMAIL;
const PASSWORD = process.env.MAZDA_PASSWORD;
const REGION = process.env.MAZDA_REGION || "MNAO";
const PORT = process.env.PORT || 3000;

app.post("/startEngine", async (req, res) => {
  try {
    const { vid } = req.body;
    if (!vid) return res.status(400).json({ error: "Missing vid" });

    const client = new MyMazda(EMAIL, PASSWORD, REGION);
    await client.login();
    await client.startEngine(vid);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
