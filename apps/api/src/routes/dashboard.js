const express = require("express");
const EngagementMetrics = require("../models/EngagementMetrics");
const UptimeCheck = require("../models/UptimeCheck");
const Issue = require("../models/Issue");
const authMiddleware = require("../middleware/auth");
const { scopeMiddleware, requireRole } = require("../middleware/scope");
const Message = require("../models/Message");

const router = express.Router();

router.use(authMiddleware, requireRole("official", "moderator"), scopeMiddleware);

// GET /dashboard/metrics?days=30 — engagement metrics for the official's scope
router.get("/metrics", async (req, res) => {
  try {
    const days = parseInt(req.query.days || "30");
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get period strings for the range
    const periods = [];
    for (let d = 0; d < days; d++) {
      const dt = new Date();
      dt.setDate(dt.getDate() - d);
      periods.push(dt.toISOString().slice(0, 10));
    }

    const metrics = await EngagementMetrics.find({
      locationId: { $in: req.allowedLocationIds },
      period: { $in: periods },
    })
      .populate("locationId", "name tier")
      .sort({ period: 1 })
      .lean();

    res.json({ metrics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /dashboard/uptime?limit=200 — recent uptime checks
router.get("/uptime", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "200");
    const checks = await UptimeCheck.find({})
      .sort({ checkedAt: -1 })
      .limit(limit)
      .lean();
    res.json({ checks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /dashboard/moderation — messages under_review in the official's scope
router.get("/moderation", async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Get discussionIds in scope first
    const Discussion = require("../models/Discussion");
    const scopedDiscussions = await Discussion.find({
      locationId: { $in: req.allowedLocationIds },
    }).select("_id").lean();
    const discussionIds = scopedDiscussions.map((d) => d._id);

    const [messages, total] = await Promise.all([
      Message.find({ discussionId: { $in: discussionIds }, moderationStatus: "under_review" })
        .populate("authorId", "name email")
        .populate("discussionId", "title locationId")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      Message.countDocuments({ discussionId: { $in: discussionIds }, moderationStatus: "under_review" }),
    ]);

    res.json({ messages, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /dashboard/issues-summary — open/escalated issues count for official's scope
router.get("/issues-summary", async (req, res) => {
  try {
    const summary = await Issue.aggregate([
      { $match: { currentLocationId: { $in: req.allowedLocationIds } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const escalated = await Issue.countDocuments({
      currentLocationId: { $in: req.allowedLocationIds },
      "escalationHistory.0": { $exists: true },
    });

    const slaBreached = await Issue.countDocuments({
      currentLocationId: { $in: req.allowedLocationIds },
      status: "open",
      slaDeadline: { $lt: new Date() },
    });

    res.json({ byStatus: summary, escalated, slaBreached });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
