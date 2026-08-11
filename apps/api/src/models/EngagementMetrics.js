const mongoose = require("mongoose");

// Precomputed analytics document per (locationId, period).
// Written by the analytics-worker cron, read-only for the API.
const engagementMetricsSchema = new mongoose.Schema(
  {
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    tier: { type: String, required: true },
    // ISO date string for the day: "2026-08-07"
    period: { type: String, required: true },

    participationCount: { type: Number, default: 0 }, // unique users active that period
    sentimentScore: { type: Number, default: 0 }, // average of message sentiment (-1 to +1)
    topIssueIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Issue" }],
    slaBreaches: { type: Number, default: 0 },
    activeDiscussions: { type: Number, default: 0 },
    pollVoteCount: { type: Number, default: 0 },

    // Anomaly flag: true when slaBreaches > 1.5x rolling 7-day average
    anomalyFlagged: { type: Boolean, default: false },
    anomalyReason: { type: String, default: null },

    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Unique per (location, period) — upserted by worker
engagementMetricsSchema.index({ locationId: 1, period: 1 }, { unique: true });
engagementMetricsSchema.index({ tier: 1, period: 1 });

module.exports = mongoose.model("EngagementMetrics", engagementMetricsSchema);
