const express = require("express");
const Location = require("../models/Location");
const authMiddleware = require("../middleware/auth");
const { requireRole } = require("../middleware/scope");

const router = express.Router();

// GET /locations — list all locations (public, used for registration dropdown)
router.get("/", async (req, res) => {
  try {
    const locations = await Location.find({}).sort({ tier: 1, name: 1 }).lean();
    res.json({ locations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /locations/tree — return full hierarchy tree (for UI tree selector)
router.get("/tree", async (req, res) => {
  try {
    const all = await Location.find({}).lean();
    // Build a map then assemble into a tree
    const map = {};
    all.forEach((loc) => { map[loc._id] = { ...loc, children: [] }; });
    const roots = [];
    all.forEach((loc) => {
      if (!loc.parentId) {
        roots.push(map[loc._id]);
      } else if (map[loc.parentId]) {
        map[loc.parentId].children.push(map[loc._id]);
      }
    });
    res.json({ tree: roots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /locations/:id — get a single location + its immediate children
router.get("/:id", async (req, res) => {
  try {
    const location = await Location.findById(req.params.id).lean();
    if (!location) return res.status(404).json({ error: "Location not found" });

    const children = await Location.find({ parentId: req.params.id }).lean();
    res.json({ location, children });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /locations/:id/descendants — all nodes below this location
router.get("/:id/descendants", async (req, res) => {
  try {
    const descendants = await Location.find({ ancestors: req.params.id }).lean();
    res.json({ descendants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /locations — create a new location node (official/moderator only)
router.post("/", authMiddleware, requireRole("official", "moderator"), async (req, res) => {
  try {
    const { name, tier, parentId } = req.body;
    if (!name || !tier) return res.status(400).json({ error: "name and tier are required" });

    let ancestors = [];
    if (parentId) {
      const parent = await Location.findById(parentId);
      if (!parent) return res.status(400).json({ error: "Parent location not found" });
      ancestors = [...parent.ancestors, parent._id];
    }

    const location = await Location.create({ name, tier, parentId: parentId || null, ancestors });
    res.status(201).json({ location });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
