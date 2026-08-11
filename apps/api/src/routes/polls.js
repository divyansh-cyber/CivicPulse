const express = require("express");
const Poll = require("../models/Poll");
const PollVote = require("../models/PollVote");
const authMiddleware = require("../middleware/auth");
const { scopeMiddleware, requireRole } = require("../middleware/scope");

const router = express.Router();

router.use(authMiddleware, scopeMiddleware);

// GET /polls — scoped list
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { locationId: { $in: req.allowedLocationIds } };
    if (status) filter.status = status;
    else filter.status = "active"; // default to active polls

    const polls = await Poll.find(filter)
      .populate("createdBy", "name")
      .populate("locationId", "name tier")
      .sort({ createdAt: -1 })
      .lean();

    // Attach vote counts per option
    const pollIds = polls.map((p) => p._id);
    const votes = await PollVote.aggregate([
      { $match: { pollId: { $in: pollIds } } },
      { $group: { _id: { pollId: "$pollId", option: "$option" }, count: { $sum: 1 } } },
    ]);

    const voteMap = {};
    votes.forEach((v) => {
      const key = String(v._id.pollId);
      if (!voteMap[key]) voteMap[key] = {};
      voteMap[key][v._id.option] = v.count;
    });

    const enriched = polls.map((poll) => ({
      ...poll,
      voteCounts: voteMap[String(poll._id)] || {},
      totalVotes: Object.values(voteMap[String(poll._id)] || {}).reduce((s, c) => s + c, 0),
    }));

    // Check user's own vote
    const userVotes = await PollVote.find({
      pollId: { $in: pollIds },
      userId: req.user._id,
    }).lean();
    const userVoteMap = {};
    userVotes.forEach((v) => { userVoteMap[String(v.pollId)] = v.option; });

    const withUserVote = enriched.map((p) => ({
      ...p,
      userVote: userVoteMap[String(p._id)] || null,
    }));

    res.json({ polls: withUserVote });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /polls/:id
router.get("/:id", async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("locationId", "name tier")
      .lean();
    if (!poll) return res.status(404).json({ error: "Poll not found" });

    const votes = await PollVote.aggregate([
      { $match: { pollId: poll._id } },
      { $group: { _id: "$option", count: { $sum: 1 } } },
    ]);
    const voteCounts = {};
    votes.forEach((v) => { voteCounts[v._id] = v.count; });

    const userVote = await PollVote.findOne({ pollId: poll._id, userId: req.user._id }).lean();

    res.json({ poll: { ...poll, voteCounts, userVote: userVote?.option || null } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /polls — create poll (officials only)
router.post("/", requireRole("official", "moderator"), async (req, res) => {
  try {
    const { question, options, closesAt } = req.body;
    const locationId = req.body.locationId || req.user.locationId;

    if (!question || !options || options.length < 2) {
      return res.status(400).json({ error: "question and at least 2 options are required" });
    }
    if (!closesAt) {
      return res.status(400).json({ error: "closesAt is required" });
    }

    // Derive tier from location — never trust it from the request body
    const Location = require("../models/Location");
    const location = await Location.findById(locationId).lean();
    if (!location) return res.status(400).json({ error: "Invalid locationId" });

    const poll = await Poll.create({
      question,
      options,
      locationId,
      tier: location.tier,
      closesAt,
      createdBy: req.user._id,
    });
    res.status(201).json({ poll });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /polls/:id/vote
router.post("/:id/vote", async (req, res) => {
  try {
    // Only citizens can vote — officials create polls, not vote in them
    if (req.user.role !== "citizen") {
      return res.status(403).json({
        error: "Only citizens can vote in polls. Officials create polls to gather community input.",
      });
    }

    const { option } = req.body;
    if (!option) return res.status(400).json({ error: "option is required" });

    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ error: "Poll not found" });
    if (poll.status !== "active") return res.status(400).json({ error: "Poll is closed" });
    if (!poll.options.includes(option)) return res.status(400).json({ error: "Invalid option" });

    try {
      await PollVote.create({ pollId: poll._id, userId: req.user._id, option });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        return res.status(409).json({ error: "You have already voted on this poll" });
      }
      throw dupErr;
    }

    res.json({ message: "Vote recorded" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
