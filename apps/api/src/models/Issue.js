const mongoose = require("mongoose");

const escalationEntrySchema = new mongoose.Schema(
  {
    fromLocationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    toLocationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    atTier: { type: String, required: true },
    movedAt: { type: Date, default: Date.now },
    reason: { type: String, default: "SLA breach" },
  },
  { _id: false }
);

const issueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // originLocationId never changes — records where the issue was filed
    originLocationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    // currentLocationId moves up the tree on each escalation
    currentLocationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },

    status: {
      type: String,
      enum: ["open", "under_review", "approved", "implemented", "closed"],
      default: "open",
    },

    votes: {
      up: { type: Number, default: 0 },
      down: { type: Number, default: 0 },
    },

    // Who has already voted: { userId, direction }
    voters: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        direction: { type: String, enum: ["up", "down"] },
        _id: false,
      },
    ],

    // BullMQ job id for the current SLA check — stored so we can cancel/replace on manual escalation
    slaJobId: { type: String, default: null },
    slaDeadline: { type: Date, required: true },

    escalationHistory: [escalationEntrySchema],

    // AI-generated risk flag (from escalation-risk agent)
    aiRiskFlag: {
      flagged: { type: Boolean, default: false },
      reason: { type: String, default: null },
      checkedAt: { type: Date, default: null },
    },

    tags: [String],
  },
  { timestamps: true }
);

issueSchema.index({ currentLocationId: 1, status: 1 });
issueSchema.index({ slaDeadline: 1 });
issueSchema.index({ originLocationId: 1 });

module.exports = mongoose.model("Issue", issueSchema);
