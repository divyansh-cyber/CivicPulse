const mongoose = require("mongoose");

const pollSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    options: [{ type: String, required: true }],
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    tier: {
      type: String,
      enum: ["locality", "colony", "municipality", "city"],
      required: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    closesAt: { type: Date, required: true },
    status: { type: String, enum: ["active", "closed"], default: "active" },
  },
  { timestamps: true }
);

pollSchema.index({ locationId: 1, status: 1 });

module.exports = mongoose.model("Poll", pollSchema);
