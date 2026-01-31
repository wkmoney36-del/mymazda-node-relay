import express from "express";
import * as MazdaPkg from "node-mymazda";

const app = express();
app.use(express.json());

// Env vars (set these in Railway → Variables)
const EMAIL = process.env.MAZDA_EMAIL;
const PASSWORD = process.env.MAZDA_PASSWORD;
const REGION = process.env.MAZDA_REGION || "MNAO";
const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3000;

/**
 * node-mymazda can export in different shapes depending on build/tooling.
 * This tries the common patterns: default export, named exports, or module itself.
 */
const MyMazda =
  MazdaPkg?.default ??
  MazdaPkg?.MyMazda ??
  MazdaPkg?.Mazda ??
  MazdaPkg;

/** Simple auth: require x-api-key header to match API_KEY env var */
function requireApiKey(req, res) {
  if (!API_KEY) {
    res.status(500).json({ error: "Server missing API_KEY env var" });
    return false;
  }
  if (req.header("x-api-key") !== API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

/** Build Mazda client safely + validate env vars */
function makeClient() {
  if (!EMAIL || !PASSWORD) {
    throw new Error("Missing MAZDA_EMAIL or MAZDA_PASSWORD env vars");
  }
  if (typeof MyMazda !== "function") {
    // This will tell us how the package is exported if it still fails
    throw new Error(
      `MyMazda is not a constructor. node-mymazda export keys: ${Object.keys(MazdaPkg).join(", ")}`
    );
  }
  return new MyMazda(EMAIL, PASSWORD, REGION);
}

// Health check (so the base URL shows something useful)
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    hasEmail: !!EMAIL,
    hasPassword: !!PASSWORD,
    region: REGION,
    hasApiKey: !!API_KEY,
  });
});

// List vehicles (so you can discover the real VID)
app.get("/vehicles", async (req, res) => {
  try {
    if (!requireApiKey(req, res)) return;

    const client = makeClient();
    await client.login();

    // Try common method names depending on library version
    const vehicles =
      (await client.getVehicles?.()) ??
      (await client.vehicles?.()) ??
      (await client.getVehicleList?.()) ??
      null;

    if (!vehicles) {
      return res.status(500).json({
        error:
          "Could not find a vehicle-list method on node-mymazda client. Tell me what methods exist and I’ll adjust.",
      });
    }

    res.json({ vehicles });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Start engine
app.post("/startEngine", async (req, res) => {
  try {
    if (!requireApiKey(req, res)) return;

    const { vid } = req.body;
    if (!vid) return res.status(400).json({ error: "Missing vid" });

    const client = makeClient();
    await client.login();

    if (typeof client.startEngine !== "function") {
      return res.status(500).json({
        error:
          "node-mymazda client has no startEngine() method. We need to map to the correct method name.",
      });
    }

    await client.startEngine(vid);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
