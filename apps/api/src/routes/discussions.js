const express = require("express");
const axios = require("axios");
const Discussion = require("../models/Discussion");
const Message = require("../models/Message");
const authMiddleware = require("../middleware/auth");
const { scopeMiddleware, requireRole } = require("../middleware/scope");

const router = express.Router();

router.use(authMiddleware, scopeMiddleware);

// GET /discussions — scoped list
router.get("/", async (req, res) => {
  try {
    const discussions = await Discussion.find({
      locationId: { $in: req.allowedLocationIds },
    })
      .populate("createdBy", "name")
      .populate("locationId", "name tier")
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ discussions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /discussions/:id — thread with messages
router.get("/:id", async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("locationId", "name tier")
      .lean();
    if (!discussion) return res.status(404).json({ error: "Discussion not found" });

    const allowed = req.allowedLocationIds.map(String);
    if (!allowed.includes(String(discussion.locationId._id))) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Only return visible messages; moderators also see under_review
    const statusFilter = req.user.role === "moderator"
      ? { moderationStatus: { $in: ["visible", "under_review"] } }
      : { moderationStatus: "visible" };

    const messages = await Message.find({ discussionId: discussion._id, ...statusFilter })
      .populate("authorId", "name role")
      .sort({ createdAt: 1 })
      .lean();

    res.json({ discussion, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /discussions — create thread
router.post("/", async (req, res) => {
  try {
    const { title } = req.body;
    // locationId can be provided by the client or fall back to the user's own location
    const locationId = req.body.locationId || req.user.locationId;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "title is required" });
    }

    // Look up the location to get its tier — client doesn't need to send it
    const Location = require("../models/Location");
    const location = await Location.findById(locationId).lean();
    if (!location) return res.status(400).json({ error: "Invalid locationId" });

    const discussion = await Discussion.create({
      title: title.trim(),
      locationId,
      tier: location.tier,          // derived from location, not trusted from body
      createdBy: req.user._id,
    });

    res.status(201).json({ discussion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /discussions/:id/lock — toggle lock/unlock (officials + moderators)
router.patch("/:id/lock", requireRole("official", "moderator"), async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    if (!discussion) return res.status(404).json({ error: "Discussion not found" });

    const newStatus = discussion.status === "locked" ? "open" : "locked";
    discussion.status = newStatus;
    await discussion.save();

    // Notify everyone in the room
    req.app.get("io")
      .to(`discussion:${discussion._id}`)
      .emit("discussion_status_changed", { discussionId: discussion._id, status: newStatus });

    res.json({ discussion: { _id: discussion._id, status: newStatus } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /discussions/:id/messages — post a message (async AI moderation)
router.post("/:id/messages", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "content is required" });
    }

    const discussion = await Discussion.findById(req.params.id);
    if (!discussion) return res.status(404).json({ error: "Discussion not found" });
    if (discussion.status === "locked") {
      return res.status(403).json({ error: "Discussion is locked" });
    }

    // Create message immediately — moderation runs async
    const message = await Message.create({
      discussionId: discussion._id,
      authorId: req.user._id,
      content: content.trim(),
    });

    // Increment count
    await Discussion.findByIdAndUpdate(discussion._id, { $inc: { messageCount: 1 } });

    // Emit via Socket.io
    const io = req.app.get("io");
    const populatedMsg = await Message.findById(message._id).populate("authorId", "name role").lean();
    io.to(`discussion:${discussion._id}`).emit("new_message", populatedMsg);

    // Async AI moderation — fire and forget
    moderateMessageAsync(message._id, content, discussion._id, io);

    res.status(201).json({ message: populatedMsg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /discussions/:id/messages/:msgId/moderate — human moderation action
router.patch("/:id/messages/:msgId/moderate", requireRole("moderator", "official"), async (req, res) => {
  try {
    const { moderationStatus } = req.body;
    if (!["visible", "hidden", "under_review"].includes(moderationStatus)) {
      return res.status(400).json({ error: "Invalid moderationStatus" });
    }

    const message = await Message.findByIdAndUpdate(
      req.params.msgId,
      { moderationStatus, moderatedBy: req.user._id, moderatedAt: new Date() },
      { new: true }
    ).lean();

    if (!message) return res.status(404).json({ error: "Message not found" });
    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /discussions/:id/summary — AI-generated thread digest
router.get("/:id/summary", requireRole("official", "moderator"), async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id).lean();
    if (!discussion) return res.status(404).json({ error: "Discussion not found" });

    if (discussion.aiSummary) {
      return res.json({ summary: discussion.aiSummary, updatedAt: discussion.aiSummaryUpdatedAt });
    }

    // Trigger summarization
    try {
      const messages = await Message.find({
        discussionId: discussion._id,
        moderationStatus: "visible",
      }).sort({ createdAt: 1 }).limit(200).lean();

      const transcript = messages.map((m) => m.content).join("\n");
      const aiRes = await axios.post(`${process.env.AI_SERVICE_URL}/summarize`, { transcript });

      await Discussion.findByIdAndUpdate(discussion._id, {
        aiSummary: aiRes.data.summary,
        aiSummaryUpdatedAt: new Date(),
      });

      res.json({ summary: aiRes.data.summary });
    } catch {
      res.json({ summary: null, note: "AI service unavailable" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Internal: run AI moderation asynchronously after message creation
async function moderateMessageAsync(messageId, content, discussionId, io) {
  try {
    const aiRes = await axios.post(
      `${process.env.AI_SERVICE_URL}/moderate`,
      { content },
      { timeout: 10000 }
    );

    const { toxic, offTopic, score, sentiment } = aiRes.data;
    let moderationStatus = "visible";
    if (score > 0.9) moderationStatus = "hidden";
    else if (score > 0.7) moderationStatus = "under_review";

    const updated = await Message.findByIdAndUpdate(
      messageId,
      {
        aiFlag: { toxic, offTopic, score, sentiment, checkedAt: new Date() },
        moderationStatus,
      },
      { new: true }
    ).populate("authorId", "name role").lean();

    // Always notify the room so the UI can update the message's aiFlag (red badge) and status
    io.to(`discussion:${discussionId}`).emit("message_moderated", updated);
  } catch {
    // AI service unavailable — leave message visible, moderation will be manual
  }
}

module.exports = router;
