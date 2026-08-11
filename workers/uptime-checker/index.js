/**
 * Uptime Checker — Synthetic Self-Monitoring
 *
 * Pings own API endpoints every 30 seconds and logs latency/status
 * to the uptime_checks collection. The dashboard reads from this to
 * render the uptime/latency panel.
 *
 * Labeled as "synthetic self-monitoring" in the README — same logic as
 * ThousandEyes but checking our own endpoints instead of third-party networks.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const cron = require("node-cron");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/civicpulse";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";
const INTERVAL = parseInt(process.env.CHECK_INTERVAL_SECONDS || "30");

// Inline schema (standalone worker)
const uptimeSchema = new mongoose.Schema({
  endpoint: String,
  url: String,
  latencyMs: Number,
  status: Number,
  ok: Boolean,
  checkedAt: { type: Date, default: Date.now },
});
uptimeSchema.index({ endpoint: 1, checkedAt: -1 });

let UptimeCheck;

// Endpoints to monitor
const ENDPOINTS = [
  { name: "/health", path: "/health" },
  { name: "/issues", path: "/issues" },
  { name: "/polls", path: "/polls" },
];

async function pingEndpoint(endpoint) {
  const url = `${API_BASE_URL}${endpoint.path}`;
  const start = Date.now();
  let status = 0;
  let ok = false;

  try {
    const res = await axios.get(url, {
      timeout: 10000,
      // For protected routes, we'll get a 401 — that's fine, the endpoint is up
      validateStatus: () => true,
    });
    status = res.status;
    ok = status < 500; // 401/403 still means the server is up
  } catch (err) {
    // Timeout or connection refused
    status = 0;
    ok = false;
  }

  const latencyMs = Date.now() - start;
  return { endpoint: endpoint.name, url, latencyMs, status, ok };
}

async function runChecks() {
  const results = await Promise.all(ENDPOINTS.map(pingEndpoint));

  await UptimeCheck.insertMany(
    results.map((r) => ({ ...r, checkedAt: new Date() }))
  );

  const summary = results.map((r) => `  ${r.ok ? "✅" : "❌"} ${r.endpoint}: ${r.latencyMs}ms (${r.status})`).join("\n");
  console.log(`[${new Date().toISOString()}] Uptime check:\n${summary}`);

  // Prune records older than 24 hours to keep the collection lean
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  await UptimeCheck.deleteMany({ checkedAt: { $lt: cutoff } });
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  UptimeCheck = mongoose.models.UptimeCheck || mongoose.model("UptimeCheck", uptimeSchema);
  console.log("✅ Uptime Checker connected to MongoDB");
  console.log(`🔍 Monitoring ${ENDPOINTS.length} endpoints every ${INTERVAL} seconds`);

  // Run immediately
  await runChecks();

  // Then every N seconds using cron (minimum 1 minute for node-cron)
  // For sub-minute intervals, use setInterval
  setInterval(async () => {
    try {
      await runChecks();
    } catch (err) {
      console.error("Uptime check error:", err.message);
    }
  }, INTERVAL * 1000);
}

main().catch((e) => { console.error(e); process.exit(1); });
