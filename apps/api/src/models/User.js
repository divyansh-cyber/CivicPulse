const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    mfaSecret: { type: String, default: null }, // TOTP secret (future)
    role: {
      type: String,
      enum: ["citizen", "official", "moderator"],
      default: "citizen",
    },
    // For citizens: their home locality id
    // For officials: their jurisdiction root location id
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    // Officials only: "locality" | "colony" | "municipality" | "city"
    scopeTier: { type: String, default: null },
    // Citizens only: additional location ids they've been elevated into (cross-locality spaces)
    elevatedSpaceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Location" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
