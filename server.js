import express from "express";
import * as MazdaPkg from "node-mymazda";

const app = express();
app.use(express.json());

// Env vars (set in Railway → Variables)
const EMAIL = process.env.MAZDA_EMAIL;
const PASSWORD = process.env.MAZDA_PASSWORD;
const REGION = process.env.MAZDA_REGION || "MNAO";
const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3000;

/**
 * node-mymazda export unwrapping:
 * Some packages end up as { default: ... } or { default: { default: ... } }
 */
const mod0 = MazdaPkg;
const mod1 = MazdaPkg?.default ?? mod0;
const mod2 = mod1?.default ?? mod1;

/**
 * Find a constructor function in common locations.
 * We try:
 *  - default.default (function or has .MyMazda/.Mazda)
 *  - default (function or has .MyMazda/.Mazda)
 *  - module itself (function or has .MyMazda/.Mazda)
 */
const MyMazdaCtor =
  (typeof mod2 === "function" ? mod2 : null) ||
  mod2?.MyMazda ||
  mod2?.Mazda ||
  (typeof mod1 === "function" ? mod1 : null) ||
  mod1?.MyMazda ||
  mod1?.Mazda ||
  (typeof mod0 === "function" ? mod0 : null) ||
  mod0?.MyMazda ||
  mod0?.Mazda ||
  null;

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

function makeClient() {
  if (!EMAIL || !PASSWORD) {
    throw new Error("Missing MAZDA_EMAIL or MAZDA_PASSWORD env vars");
  }

  if (typeof MyMazdaCtor !== "function") {
    const keys0 = Object.keys(mod0 || {});
    const keys1 = mod1 && typeof mod1 === "object" ? Object.keys(mod1) : [];
    const keys2 = mod2 && typeof mod2 === "object" ? Object.keys(mod2) : [];
    throw new Error(
      "MyMazda constructor not found. " +
        `pkg keys: ${keys0.join(", ")} | ` +
        `default type: ${typeof mod1} keys: ${keys1.join(", ")} | ` +
        `default.default type: ${typeof mod2} keys: ${keys2.join(", ")}`
    );
  }

  return new MyMazdaCtor(EMAIL, PASSWORD, REGION);
}

// Health endpoint so browser doesn't confuse you
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    hasEmail: !!EMAIL,
    hasPassword: !!PASSWORD,
    region: REGION,
    hasApiKey: !!API_KEY,
    exportKeys: Object.keys(MazdaPkg || {}),
    defaultType: typeof mod1,
    defaultDefaultType: typeof mod2,
  });
});

// List vehicles so you can find the correct VID
app.get("/vehicles", async (req, res) => {
  try {
    if (!requireApiKey(req, res)) return;

    const client = makeClient();
    await client.login();

    const vehicles =
      (await client.getVehicles?.()) ??
      (await client.vehicles?.()) ??
      (await client.getVehicleList?.()) ??
      null;

    if (!vehicles) {
      return res.status(500).json({
        error:
          "Could not find a vehicle-list method on the node-mymazda client. " +
          "If you paste the output of /health (or the list of methods on client), I’ll map it.",
      });
    }

    res.json({ vehicles });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Start engine endpoint
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
          "node-mymazda client has no startEngine() method. " +
          "We may need to call a differently named method (remoteStart, start, etc.).",
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
