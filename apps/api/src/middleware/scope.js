const Location = require("../models/Location");

/**
 * Scope middleware — computes the set of locationIds the current user
 * is allowed to see and attaches it to req.allowedLocationIds.
 *
 * Citizens: only their home locationId + any elevatedSpaceIds
 * Officials/Moderators: their jurisdiction root + every descendant
 *   (efficiently fetched via the ancestors array index in a single query)
 *
 * Every subsequent query for issues/polls/discussions MUST filter by:
 *   { currentLocationId: { $in: req.allowedLocationIds } }
 */
async function scopeMiddleware(req, res, next) {
  try {
    const user = req.user;

    if (user.role === "citizen") {
      req.allowedLocationIds = [
        user.locationId,
        ...(user.elevatedSpaceIds || []),
      ];
    } else {
      // Official or moderator: their node + all descendants
      const scoped = await Location.find({
        $or: [
          { _id: user.locationId },
          { ancestors: user.locationId },
        ],
      })
        .select("_id")
        .lean();

      req.allowedLocationIds = scoped.map((l) => l._id);
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role guard factory — use to restrict routes to specific roles.
 * Example: requireRole("official", "moderator")
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

module.exports = { scopeMiddleware, requireRole };
