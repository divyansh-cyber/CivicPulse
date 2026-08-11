const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Location = require("../models/Location");

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, locationId, role } = req.body;

    if (!name || !email || !password || !locationId) {
      return res.status(400).json({ error: "name, email, password, locationId are required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const location = await Location.findById(locationId);
    if (!location) return res.status(400).json({ error: "Invalid locationId" });

    // Only allow citizen self-registration; official/moderator must be seeded or admin-created
    const allowedRole = role === "citizen" ? "citizen" : "citizen";

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: allowedRole,
      locationId,
      scopeTier: location.tier,
    });

    const token = signToken(user._id);
    res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        locationId: user.locationId,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user._id);
    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        locationId: user.locationId,
        scopeTier: user.scopeTier,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /auth/me — return current user with full location context
router.get("/me", require("../middleware/auth"), async (req, res) => {
  try {
    const user = req.user;

    // Populate the user's own location with full ancestry
    const userLocation = await Location.findById(user.locationId).lean();

    // Fetch the full ancestor chain (city → municipality → colony → locality)
    const ancestorDocs = userLocation?.ancestors?.length
      ? await Location.find({ _id: { $in: userLocation.ancestors } }).lean()
      : [];

    // For officials: fetch all descendant locations (colonies + localities under them)
    // and map which official manages each one
    let jurisdictionTree = null;
    if (user.role === "official" || user.role === "moderator") {
      const User = require("../models/User");
      const descendants = await Location.find({ ancestors: user.locationId }).lean();
      const allScopeLocations = [userLocation, ...descendants].filter(Boolean);

      // Find all officials and index by locationId
      const officials = await User.find({ role: "official" }).select("name email locationId scopeTier").lean();
      const officialByLocation = {};
      officials.forEach((o) => { officialByLocation[String(o.locationId)] = o; });

      jurisdictionTree = allScopeLocations.map((loc) => ({
        ...loc,
        official: officialByLocation[String(loc._id)] ?? null,
      }));
    }

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        scopeTier: user.scopeTier,
        locationId: user.locationId,
        location: userLocation,
        ancestors: ancestorDocs,
        jurisdictionTree,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
