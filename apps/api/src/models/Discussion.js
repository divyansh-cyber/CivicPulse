const mongoose = require("mongoose");

const discussionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    tier: {
      type: String,
      enum: ["locality", "colony", "municipality", "city"],
      required: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["open", "locked"], default: "open" },
    // AI-generated digest (from summarizer agent)
    aiSummary: { type: String, default: null },
    aiSummaryUpdatedAt: { type: Date, default: null },
    messageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

discussionSchema.index({ locationId: 1, status: 1 });

module.exports = mongoose.model("Discussion", discussionSchema);
