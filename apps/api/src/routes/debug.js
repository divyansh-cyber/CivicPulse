const express = require("express");
const Issue = require("../models/Issue");
const { addSlaJob, cancelSlaJob, escalationQueue } = require("../queues");

const router = express.Router();

/**
 * POST /debug/fast-forward/:issueId?delayMs=5000
 *
 * Demo-only endpoint: reschedules the SLA job for the given issue to fire
 * in N milliseconds instead of hours — makes escalation visible on camera.
 * Works with both BullMQ (Redis) and the in-memory fallback.
 */
router.post("/fast-forward/:issueId", async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.issueId);
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    if (issue.status !== "open") {
      return res.status(400).json({ error: "Issue is not open — nothing to escalate" });
    }

    const FAST_FORWARD_MS = parseInt(req.query.delayMs || "5000");

    // Cancel existing job (in-memory timer or BullMQ job)
    cancelSlaJob(issue._id.toString());

    if (escalationQueue && issue.slaJobId) {
      try {
        const existingJob = await escalationQueue.getJob(issue.slaJobId);
        if (existingJob) await existingJob.remove();
      } catch {
        // ignore — job may have already fired
      }
    }

    // Re-enqueue with short delay
    const newJobId = await addSlaJob(issue._id.toString(), FAST_FORWARD_MS);
    await Issue.findByIdAndUpdate(issue._id, { slaJobId: newJobId });

    res.json({
      message: `⚡ Escalation job scheduled in ${FAST_FORWARD_MS}ms`,
      jobId: newJobId,
      issueId: issue._id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
