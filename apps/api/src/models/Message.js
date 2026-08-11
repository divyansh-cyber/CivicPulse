const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    discussionId: { type: mongoose.Schema.Types.ObjectId, ref: "Discussion", required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true },

    // AI moderation output (written async after message creation)
    aiFlag: {
      toxic: { type: Boolean, default: false },
      offTopic: { type: Boolean, default: false },
      score: { type: Number, default: 0 }, // 0.0 – 1.0, higher = more problematic
      sentiment: { type: Number, default: 0 }, // -1 negative, 0 neutral, +1 positive
      checkedAt: { type: Date, default: null },
    },

    // "visible" | "hidden" (auto-hidden by AI score > 0.9) | "under_review" (0.7-0.9, awaiting human)
    moderationStatus: {
      type: String,
      enum: ["visible", "hidden", "under_review"],
      default: "visible",
    },

    // Moderator action log
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    moderatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ discussionId: 1, createdAt: 1 });
messageSchema.index({ moderationStatus: 1 });

module.exports = mongoose.model("Message", messageSchema);
