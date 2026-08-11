/**
 * Escalation Worker — BullMQ consumer
 *
 * Processes "check-sla" jobs enqueued by the API when an issue is created.
 * When a job fires and the issue is still open:
 *   1. Escalates the issue to the parent location
 *   2. Logs the escalation in escalationHistory
 *   3. Sets a new SLA deadline for the parent tier
 *   4. Notifies the parent-tier room via Socket.io
 *   5. Re-enqueues a new check-sla job for the next tier
 */
require("dotenv").config();
const { Worker, Queue } = require("bullmq");
const mongoose = require("mongoose");
const { io: socketIoClient } = require("socket.io-client");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/civicpulse";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";

const SLA_HOURS = {
  locality: parseInt(process.env.SLA_HOURS_LOCALITY || "48"),
  colony: parseInt(process.env.SLA_HOURS_COLONY || "72"),
  municipality: parseInt(process.env.SLA_HOURS_MUNICIPALITY || "120"),
  city: parseInt(process.env.SLA_HOURS_CITY || "168"),
};

function slaMs(tier) {
  return (SLA_HOURS[tier] || 48) * 3600 * 1000;
}

// Redis connection config
const redisUrl = new URL(REDIS_URL);
const isTls = redisUrl.protocol === "rediss:" || redisUrl.hostname.includes("upstash.io");
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || "6379"),
  username: redisUrl.username || undefined,
  password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
  tls: isTls ? {} : undefined,
};

// Queues
const escalationQueue = new Queue("escalation", { connection });
const notifyQueue = new Queue("notifications", { connection });

// Inline mongoose models (worker is a standalone process — not importing from api)
let Location, Issue;

async function initModels() {
  const locationSchema = new mongoose.Schema({
    name: String,
    tier: String,
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", default: null },
    ancestors: [mongoose.Schema.Types.ObjectId],
  }, { timestamps: true });

  const escalationEntrySchema = new mongoose.Schema({
    fromLocationId: mongoose.Schema.Types.ObjectId,
    toLocationId: mongoose.Schema.Types.ObjectId,
    atTier: String,
    movedAt: { type: Date, default: Date.now },
    reason: { type: String, default: "SLA breach" },
  }, { _id: false });

  const issueSchema = new mongoose.Schema({
    title: String,
    status: String,
    currentLocationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
    slaDeadline: Date,
    slaJobId: String,
    escalationHistory: [escalationEntrySchema],
    votes: { up: Number, down: Number },
    aiRiskFlag: { flagged: Boolean, reason: String, checkedAt: Date },
  }, { timestamps: true });

  Location = mongoose.models.Location || mongoose.model("Location", locationSchema);
  Issue = mongoose.models.Issue || mongoose.model("Issue", issueSchema);
}

// Socket.io client — connect to the API server to emit events into rooms
let socketClient;

function getSocket() {
  if (!socketClient || !socketClient.connected) {
    socketClient = socketIoClient(API_BASE_URL, { reconnection: true });
    socketClient.on("connect", () => console.log("🔌 Connected to API Socket.io"));
    socketClient.on("disconnect", () => console.log("⚡ Disconnected from API Socket.io"));
  }
  return socketClient;
}

// ── The worker ────────────────────────────────────────────────────────────
const worker = new Worker(
  "escalation",
  async (job) => {
    const { issueId } = job.data;
    console.log(`⏰ Processing SLA check for issue ${issueId}`);

    const issue = await Issue.findById(issueId);
    if (!issue) {
      console.log(`  ❌ Issue ${issueId} not found — skipping`);
      return;
    }

    if (issue.status !== "open") {
      console.log(`  ✅ Issue ${issueId} status is "${issue.status}" — no escalation needed`);
      return;
    }

    const currentLoc = await Location.findById(issue.currentLocationId);
    if (!currentLoc) {
      console.log(`  ❌ Location not found for issue ${issueId}`);
      return;
    }

    if (!currentLoc.parentId) {
      console.log(`  🏙️  Issue ${issueId} already at city tier — no parent to escalate to`);
      return;
    }

    const parentLoc = await Location.findById(currentLoc.parentId);
    if (!parentLoc) {
      console.log(`  ❌ Parent location not found`);
      return;
    }

    // ── Escalate ──────────────────────────────────────────────────────────
    issue.escalationHistory.push({
      fromLocationId: currentLoc._id,
      toLocationId: parentLoc._id,
      atTier: currentLoc.tier,
      movedAt: new Date(),
      reason: "SLA breach",
    });
    issue.currentLocationId = parentLoc._id;
    issue.slaDeadline = new Date(Date.now() + slaMs(parentLoc.tier));

    // Enqueue next SLA check for the parent tier
    const nextJob = await escalationQueue.add(
      "check-sla",
      { issueId: issueId.toString() },
      { delay: slaMs(parentLoc.tier), jobId: `sla-${issueId}-${Date.now()}` }
    );
    issue.slaJobId = nextJob.id;

    await issue.save();

    console.log(`  🚀 Issue ${issueId} escalated: ${currentLoc.name} → ${parentLoc.name} (${parentLoc.tier})`);

    // Notify via Socket.io
    try {
      const socket = getSocket();
      socket.emit("issue_escalated", {
        issueId: issueId.toString(),
        fromLocation: { _id: currentLoc._id, name: currentLoc.name, tier: currentLoc.tier },
        toLocation: { _id: parentLoc._id, name: parentLoc.name, tier: parentLoc.tier },
        escalatedAt: new Date(),
      });
    } catch (sockErr) {
      console.warn("  ⚠️  Could not notify Socket.io:", sockErr.message);
    }

    // Enqueue official notification
    await notifyQueue.add("notify-official", {
      locationId: parentLoc._id.toString(),
      issueId: issueId.toString(),
      issueTitle: issue.title,
      tier: parentLoc.tier,
    });
  },
  { connection, concurrency: 5 }
);

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

// ── Notification consumer (simple logger — no email service needed for demo) ──
const notifyWorker = new Worker(
  "notifications",
  async (job) => {
    const { locationId, issueId, issueTitle, tier } = job.data;
    // In production, this would send email/push to officials in locationId.
    // For demo, just log it.
    console.log(`📬 [NOTIFY] Issue "${issueTitle}" escalated to ${tier} (loc: ${locationId})`);
  },
  { connection }
);

// ── Bootstrap ─────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(MONGODB_URI);
  await initModels();
  console.log("✅ Escalation Worker connected to MongoDB");
  console.log("⏳ Waiting for SLA jobs...");
}

main().catch((e) => { console.error(e); process.exit(1); });
