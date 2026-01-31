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
 * Often ends up as { default: ... } or { default: { default: ... } }
 */
const mod0 = MazdaPkg;
const mod1 = MazdaPkg?.default ?? mod0;
const mod2 = mod1?.default ?? mod1;

/**
 * Find a constructor/function in common locations.
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

/**
 * Try to authenticate no matter what method name the client uses.
 */
async function ensureAuthed(client) {
  // Common auth method names across unofficial libs
  const candidates = [
    "login",
    "signIn",
    "signin",
    "authenticate",
    "auth",
    "init",
    "initialize",
    "connect",
  ];

  for (const name of candidates) {
    if (typeof client[name] === "function") {
      await client[name]();
      return name;
    }
  }

  // Some libs auto-auth on construction; if so, no method needed.
  return null;
}

/**
 * Try to list vehicles no matter what method name exists.
 */
async function fetchVehicles(client) {
  const candidates = [
    "getVehicles",
    "vehicles",
    "getVehicleList",
    "listVehicles",
    "fetchVehicles",
    "getMyVehicles",
  ];

  for (const name of candidates) {
    if (typeof client[name] === "function") {
      const v = await client[name]();
      return { method: name, vehicles: v };
    }
  }

  // Sometimes vehicles live as a property after auth
  if (Array.isArray(client.vehicles)) return { method: "vehicles(property)", vehicles: client.vehicles };

  return { method: null, vehicles: null };
}

/**
 * Try to start engine no matter what method name exists.
 */
async function startEngineAny(client, vid) {
  const candidates = [
    "startEngine",
    "remoteStart",
    "start",
    "engineStart",
    "startRemote",
    "remoteEngineStart",
  ];

  for (const name of candidates) {
    if (typeof client[name] === "function") {
      const out = await client[name](vid);
      return { method: name, result: out ?? null };
    }
  }

  return { method: null, result: null };
}

// Health endpoint (no auth required)
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

// Debug endpoint (auth required) — shows what methods exist on the client
app.get("/debug", (req, res) => {
  try {
    if (!requireApiKey(req, res)) return;

    const client = makeClient();
    const proto = Object.getPrototypeOf(client);

    res.json({
      ctorName: client?.constructor?.name,
      ownKeys: Object.keys(client),
      protoKeys: Object.getOwnPropertyNames(proto).filter(
        (k) => typeof proto[k] === "function"
      ),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Vehicles (auth required)
app.get("/vehicles", async (req, res) => {
  try {
    if (!requireApiKey(req, res)) return;

    const client = makeClient();
    const authedWith = await ensureAuthed(client);
    const { method: vehiclesWith, vehicles } = await fetchVehicles(client);

    if (!vehicles) {
      return res.status(500).json({
        error:
          "Could not find a vehicle-list method on the node-mymazda client.",
        authedWith,
        vehiclesWith,
        hint: "Call /debug and paste the protoKeys here if this persists.",
      });
    }

    res.json({ authedWith, vehiclesWith, vehicles });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Start engine (auth required)
app.post("/startEngine", async (req, res) => {
  try {
    if (!requireApiKey(req, res)) return;

    const { vid } = req.body;
    if (!vid) return res.status(400).json({ error: "Missing vid" });

    const client = makeClient();
    const authedWith = await ensureAuthed(client);
    const { method: startWith, result } = await startEngineAny(client, vid);

    if (!startWith) {
      return res.status(500).json({
        error:
          "Could not find an engine-start method on the node-mymazda client.",
        authedWith,
        hint: "Call /debug and paste the protoKeys here.",
      });
    }

    res.json({ ok: true, authedWith, startWith, result });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
