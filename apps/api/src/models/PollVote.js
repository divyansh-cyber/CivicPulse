const mongoose = require("mongoose");

const pollVoteSchema = new mongoose.Schema(
  {
    pollId: { type: mongoose.Schema.Types.ObjectId, ref: "Poll", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    option: { type: String, required: true }, // the chosen option text
    votedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Unique compound index prevents double-voting
pollVoteSchema.index({ pollId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("PollVote", pollVoteSchema);
