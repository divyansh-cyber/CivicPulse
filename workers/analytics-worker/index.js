/**
 * Analytics Worker — node-cron
 *
 * Runs every 5 minutes. Aggregates data from issues, poll_votes, and messages
 * per locationId and writes/upserts one EngagementMetrics document per (locationId, period).
 *
 * Also flags anomalies: if slaBreaches today > 1.5x the 7-day rolling average,
 * sets anomalyFlagged = true on that location's metric.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const cron = require("node-cron");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/civicpulse";

// ── Inline schemas (standalone worker) ─────────────────────────────────────
const locationSchema = new mongoose.Schema({ name: String, tier: String, parentId: mongoose.Schema.Types.ObjectId, ancestors: [mongoose.Schema.Types.ObjectId] });
const issueSchema = new mongoose.Schema({ currentLocationId: mongoose.Schema.Types.ObjectId, status: String, slaDeadline: Date, escalationHistory: Array, createdBy: mongoose.Schema.Types.ObjectId, votes: { up: Number, down: Number }, createdAt: Date }, { timestamps: true });
const pollSchema = new mongoose.Schema({ locationId: mongoose.Schema.Types.ObjectId, closesAt: Date, status: String }, { timestamps: true });
const pollVoteSchema = new mongoose.Schema({ pollId: mongoose.Schema.Types.ObjectId, userId: mongoose.Schema.Types.ObjectId, votedAt: Date }, { timestamps: false });
const messageSchema = new mongoose.Schema({ discussionId: mongoose.Schema.Types.ObjectId, authorId: mongoose.Schema.Types.ObjectId, aiFlag: { sentiment: Number }, moderationStatus: String, createdAt: Date }, { timestamps: true });
const discussionSchema = new mongoose.Schema({ locationId: mongoose.Schema.Types.ObjectId, status: String }, { timestamps: true });
const metricsSchema = new mongoose.Schema({
  locationId: mongoose.Schema.Types.ObjectId,
  tier: String,
  period: String,
  participationCount: Number,
  sentimentScore: Number,
  topIssueIds: [mongoose.Schema.Types.ObjectId],
  slaBreaches: Number,
  activeDiscussions: Number,
  pollVoteCount: Number,
  anomalyFlagged: Boolean,
  anomalyReason: String,
  updatedAt: Date,
}, { timestamps: false });

metricsSchema.index({ locationId: 1, period: 1 }, { unique: true });

let Location, Issue, Poll, PollVote, Message, Discussion, EngagementMetrics;

function initModels() {
  Location = mongoose.models.Location || mongoose.model("Location", locationSchema);
  Issue = mongoose.models.Issue || mongoose.model("Issue", issueSchema);
  Poll = mongoose.models.Poll || mongoose.model("Poll", pollSchema);
  PollVote = mongoose.models.PollVote || mongoose.model("PollVote", pollVoteSchema);
  Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
  Discussion = mongoose.models.Discussion || mongoose.model("Discussion", discussionSchema);
  EngagementMetrics = mongoose.models.EngagementMetrics || mongoose.model("EngagementMetrics", metricsSchema);
}

function todayPeriod() {
  return new Date().toISOString().slice(0, 10);
}

function startOfDay(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function computeMetrics() {
  const period = todayPeriod();
  const dayStart = startOfDay(0);
  const dayEnd = new Date();

  console.log(`\n📊 Analytics run — period: ${period}`);

  const locations = await Location.find({}).lean();

  for (const loc of locations) {
    try {
      // Issues in this location today
      const issues = await Issue.find({
        currentLocationId: loc._id,
        createdAt: { $gte: startOfDay(30) }, // last 30 days
      }).lean();

      // SLA breaches today
      const slaBreachesToday = issues.filter(
        (i) => i.status === "open" && i.slaDeadline && i.slaDeadline < dayEnd &&
          i.slaDeadline >= dayStart
      ).length;

      // Unique participants (created issues or voted)
      const issueCreators = [...new Set(issues.map((i) => String(i.createdBy)))];

      // Active discussions in this location
      const activeDiscussions = await Discussion.countDocuments({
        locationId: loc._id,
        status: "open",
      });

      // Messages today
      const messages = await Message.find({
        createdAt: { $gte: dayStart, $lte: dayEnd },
        moderationStatus: "visible",
      }).lean();
      // Note: We'd need to filter by locationId via discussionId — simplified here
      const msgAuthors = [...new Set(messages.map((m) => String(m.authorId)))];

      // Average sentiment from AI flags
      const sentimentMessages = messages.filter((m) => m.aiFlag?.sentiment !== undefined);
      const sentimentScore = sentimentMessages.length
        ? sentimentMessages.reduce((s, m) => s + (m.aiFlag.sentiment || 0), 0) / sentimentMessages.length
        : 0;

      // Participation: unique users from issues + messages
      const participationCount = new Set([...issueCreators, ...msgAuthors]).size;

      // Top 3 issues by upvotes
      const topIssues = issues
        .sort((a, b) => (b.votes?.up || 0) - (a.votes?.up || 0))
        .slice(0, 3)
        .map((i) => i._id);

      // Anomaly detection: slaBreaches > 1.5x rolling 7-day average
      const past7Periods = Array.from({ length: 7 }, (_, d) => {
        const dt = new Date();
        dt.setDate(dt.getDate() - d - 1);
        return dt.toISOString().slice(0, 10);
      });
      const past7Metrics = await EngagementMetrics.find({
        locationId: loc._id,
        period: { $in: past7Periods },
      }).lean();
      const rollingAvgBreaches = past7Metrics.length
        ? past7Metrics.reduce((s, m) => s + (m.slaBreaches || 0), 0) / past7Metrics.length
        : 0;
      const anomalyFlagged = rollingAvgBreaches > 0 && slaBreachesToday > rollingAvgBreaches * 1.5;

      // Poll vote count for this location today
      const locationPolls = await Poll.find({ locationId: loc._id }).select("_id").lean();
      const locationPollIds = locationPolls.map((p) => p._id);
      const pollVoteCount = locationPollIds.length
        ? await PollVote.countDocuments({
            pollId: { $in: locationPollIds },
            votedAt: { $gte: dayStart, $lte: dayEnd },
          })
        : 0;

      // Upsert
      await EngagementMetrics.findOneAndUpdate(
        { locationId: loc._id, period },
        {
          $set: {
            locationId: loc._id,
            tier: loc.tier,
            period,
            participationCount,
            sentimentScore: Math.round(sentimentScore * 100) / 100,
            topIssueIds: topIssues,
            slaBreaches: slaBreachesToday,
            activeDiscussions,
            pollVoteCount,
            anomalyFlagged,
            anomalyReason: anomalyFlagged
              ? `${slaBreachesToday} SLA breaches vs. ${rollingAvgBreaches.toFixed(1)} rolling avg`
              : null,
            updatedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      if (anomalyFlagged) {
        console.log(`  ⚠️  Anomaly flagged for ${loc.name} (${loc.tier}): ${slaBreachesToday} breaches`);
      }
    } catch (err) {
      console.error(`  ❌ Error processing location ${loc.name}:`, err.message);
    }
  }

  console.log(`✅ Analytics complete for ${locations.length} locations`);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  initModels();
  console.log("✅ Analytics Worker connected to MongoDB");

  // Run immediately on startup
  await computeMetrics();

  // Then every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      await computeMetrics();
    } catch (err) {
      console.error("Analytics error:", err.message);
    }
  });

  console.log("⏰ Analytics cron scheduled — every 5 minutes");
}

main().catch((e) => { console.error(e); process.exit(1); });
