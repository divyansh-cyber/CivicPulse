const { Queue } = require("bullmq");

// Redis connection config — supports REDIS_URL (Upstash, Aiven) or REDIS_HOST/PORT
function getRedisConnection() {
  if (process.env.REDIS_URL) {
    try {
      const parsed = new URL(process.env.REDIS_URL);
      const isTls = parsed.protocol === "rediss:" || parsed.hostname.includes("upstash.io");
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port || "6379"),
        username: parsed.username || undefined,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        tls: isTls ? {} : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      };
    } catch (e) {
      console.warn("⚠️ Invalid REDIS_URL, falling back to localhost", e.message);
    }
  }
  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  };
}

const connection = getRedisConnection();

let escalationQueue = null;
let notifyQueue = null;

// Try to create BullMQ queues. Silently degrade if Redis is unavailable.
try {
  escalationQueue = new Queue("escalation", { connection });
  notifyQueue = new Queue("notifications", { connection });

  escalationQueue.on("error", () => {});
  notifyQueue.on("error", () => {});
} catch {
  console.warn("⚠️  BullMQ could not connect to Redis — using in-memory SLA fallback");
}

/**
 * addSlaJob — enqueues a check-sla delayed job.
 * Falls back to a plain setTimeout when Redis is unavailable (no-Docker mode).
 *
 * @param {string} issueId  Mongoose ObjectId string
 * @param {number} delayMs  Milliseconds until the job fires
 * @returns {string}        Job id (BullMQ id or "mem-<id>")
 */
async function addSlaJob(issueId, delayMs) {
  if (escalationQueue) {
    try {
      const job = await escalationQueue.add(
        "check-sla",
        { issueId: issueId.toString() },
        { delay: delayMs, jobId: `sla-${issueId}-${Date.now()}` }
      );
      return job.id;
    } catch {
      // Redis went away mid-run — fall through to in-memory
    }
  }

  // ── In-memory fallback (no Redis required) ────────────────────────────
  console.log(`⏰ [In-Memory SLA] Escalation scheduled for issue ${issueId} in ${delayMs / 1000}s`);

  const timerId = `mem-sla-${issueId}-${Date.now()}`;
  const timer = setTimeout(async () => {
    try {
      const Issue = require("../models/Issue");
      const Location = require("../models/Location");

      const issue = await Issue.findById(issueId);
      if (!issue || issue.status !== "open") return;

      const currentLoc = await Location.findById(issue.currentLocationId);
      if (!currentLoc || !currentLoc.parentId) {
        console.log(`🏙️  [In-Memory SLA] Issue ${issueId} already at top tier — no escalation`);
        return;
      }

      const parentLoc = await Location.findById(currentLoc.parentId);
      if (!parentLoc) return;

      const SLA_HOURS = {
        locality: parseInt(process.env.SLA_HOURS_LOCALITY || "48"),
        colony: parseInt(process.env.SLA_HOURS_COLONY || "72"),
        municipality: parseInt(process.env.SLA_HOURS_MUNICIPALITY || "120"),
        city: parseInt(process.env.SLA_HOURS_CITY || "168"),
      };

      issue.escalationHistory.push({
        fromLocationId: currentLoc._id,
        toLocationId: parentLoc._id,
        atTier: currentLoc.tier,
        movedAt: new Date(),
        reason: "SLA breach",
      });
      issue.currentLocationId = parentLoc._id;
      issue.slaDeadline = new Date(
        Date.now() + (SLA_HOURS[parentLoc.tier] || 48) * 3600 * 1000
      );
      await issue.save();

      console.log(
        `🚀 [In-Memory SLA] Issue ${issueId} escalated: ${currentLoc.name} → ${parentLoc.name} (${parentLoc.tier})`
      );

      // Schedule next tier check recursively
      await addSlaJob(
        issueId,
        (SLA_HOURS[parentLoc.tier] || 48) * 3600 * 1000
      );
    } catch (err) {
      console.error("[In-Memory SLA] Error during escalation:", err.message);
    }
  }, delayMs);

  // Keep a reference so the debug fast-forward endpoint can cancel it
  inMemoryTimers.set(issueId.toString(), timer);
  return timerId;
}

/**
 * cancelSlaJob — cancels an in-memory timer (used by the fast-forward debug endpoint).
 */
function cancelSlaJob(issueId) {
  const timer = inMemoryTimers.get(issueId.toString());
  if (timer) {
    clearTimeout(timer);
    inMemoryTimers.delete(issueId.toString());
  }
}

// Map of issueId → setTimeout handle (for cancellation on fast-forward)
const inMemoryTimers = new Map();

module.exports = {
  escalationQueue,
  notifyQueue,
  connection,
  addSlaJob,
  cancelSlaJob,
  inMemoryTimers,
};
