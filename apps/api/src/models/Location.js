const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    tier: {
      type: String,
      enum: ["locality", "colony", "municipality", "city"],
      required: true,
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", default: null },
    // All ancestor ids from root to immediate parent (root-first).
    // This enables a single indexed query to get all descendants:
    //   Location.find({ ancestors: someId })
    ancestors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Location" }],
  },
  { timestamps: true }
);

locationSchema.index({ ancestors: 1 });
locationSchema.index({ parentId: 1 });

module.exports = mongoose.model("Location", locationSchema);
