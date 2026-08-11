const mongoose = require("mongoose");

// Synthetic self-monitoring log — written by uptime-checker worker every 30s.
// Dashboard reads recent entries for each endpoint.
const uptimeCheckSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true }, // e.g. "/health", "/api/issues"
    url: { type: String, required: true },
    latencyMs: { type: Number, required: true },
    status: { type: Number, required: true }, // HTTP status code
    ok: { type: Boolean, required: true }, // status < 400
    checkedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

uptimeCheckSchema.index({ endpoint: 1, checkedAt: -1 });

module.exports = mongoose.model("UptimeCheck", uptimeCheckSchema);
