const express = require("express");
const Issue = require("../models/Issue");
const Location = require("../models/Location");
const authMiddleware = require("../middleware/auth");
const { scopeMiddleware, requireRole } = require("../middleware/scope");
const { addSlaJob } = require("../queues");

const router = express.Router();

const SLA_HOURS = {
  locality: parseInt(process.env.SLA_HOURS_LOCALITY || "48"),
  colony: parseInt(process.env.SLA_HOURS_COLONY || "72"),
  municipality: parseInt(process.env.SLA_HOURS_MUNICIPALITY || "120"),
  city: parseInt(process.env.SLA_HOURS_CITY || "168"),
};

function slaMs(tier) {
  return (SLA_HOURS[tier] || 48) * 3600 * 1000;
}

// All routes require auth + scope
router.use(authMiddleware, scopeMiddleware);

// GET /issues — scoped list
router.get("/", async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { currentLocationId: { $in: req.allowedLocationIds } };
    if (status) filter.status = status;

    const [issues, total] = await Promise.all([
      Issue.find(filter)
        .populate("createdBy", "name")
        .populate("currentLocationId", "name tier")
        .populate("originLocationId", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      Issue.countDocuments(filter),
    ]);

    res.json({ issues, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /issues/:id — single issue with full escalation history
router.get("/:id", async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("currentLocationId", "name tier")
      .populate("originLocationId", "name tier")
      .populate("escalationHistory.fromLocationId", "name tier")
      .populate("escalationHistory.toLocationId", "name tier")
      .lean();

    if (!issue) return res.status(404).json({ error: "Issue not found" });

    // Scope check: is currentLocationId in allowed set?
    const allowed = req.allowedLocationIds.map(String);
    if (!allowed.includes(String(issue.currentLocationId._id))) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ issue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /issues — create a new issue (citizens and officials)
router.post("/", async (req, res) => {
  try {
    const { title, description, tags } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: "title and description are required" });
    }

    const locationId = req.user.locationId;
    const location = await Location.findById(locationId);
    if (!location) return res.status(400).json({ error: "User location not found" });

    const slaDeadline = new Date(Date.now() + slaMs(location.tier));

    const issue = await Issue.create({
      title,
      description,
      tags: tags || [],
      createdBy: req.user._id,
      originLocationId: locationId,
      currentLocationId: locationId,
      slaDeadline,
    });

    // Enqueue SLA check job (BullMQ if Redis available, in-memory fallback otherwise)
    const jobId = await addSlaJob(issue._id.toString(), slaMs(location.tier));
    await Issue.findByIdAndUpdate(issue._id, { slaJobId: jobId });

    res.status(201).json({ issue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /issues/:id/vote — upvote or downvote
router.post("/:id/vote", async (req, res) => {
  try {
    const { direction } = req.body; // "up" | "down"
    if (!["up", "down"].includes(direction)) {
      return res.status(400).json({ error: "direction must be 'up' or 'down'" });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ error: "Issue not found" });

    const existingVote = issue.voters.find(
      (v) => String(v.userId) === String(req.user._id)
    );

    if (existingVote) {
      if (existingVote.direction === direction) {
        // Toggle off
        issue.votes[direction] = Math.max(0, issue.votes[direction] - 1);
        issue.voters = issue.voters.filter(
          (v) => String(v.userId) !== String(req.user._id)
        );
      } else {
        // Switch direction
        issue.votes[existingVote.direction] = Math.max(0, issue.votes[existingVote.direction] - 1);
        issue.votes[direction]++;
        existingVote.direction = direction;
      }
    } else {
      issue.votes[direction]++;
      issue.voters.push({ userId: req.user._id, direction });
    }

    await issue.save();
    res.json({ votes: issue.votes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /issues/:id/status — update status (officials/moderators only)
router.patch("/:id/status", requireRole("official", "moderator"), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["open", "under_review", "approved", "implemented", "closed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).lean();

    if (!issue) return res.status(404).json({ error: "Issue not found" });

    // Emit to Socket.io room
    req.app.get("io").to(`loc:${issue.currentLocationId}`).emit("issue_updated", issue);

    res.json({ issue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
