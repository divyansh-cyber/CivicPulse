require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./db");

// ── Routes ──────────────────────────────────────────────────────────────────
const authRoutes = require("./routes/auth");
const locationRoutes = require("./routes/locations");
const issueRoutes = require("./routes/issues");
const pollRoutes = require("./routes/polls");
const discussionRoutes = require("./routes/discussions");
const dashboardRoutes = require("./routes/dashboard");
const debugRoutes = require("./routes/debug");

const app = express();
const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Attach io instance so routes can access it via req.app.get("io")
app.set("io", io);

io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Client joins a location room to receive real-time issue updates
  socket.on("join:location", (locationId) => {
    socket.join(`loc:${locationId}`);
  });

  // Client joins a discussion room for live messages
  socket.on("join:discussion", (discussionId) => {
    socket.join(`discussion:${discussionId}`);
  });

  socket.on("leave:discussion", (discussionId) => {
    socket.leave(`discussion:${discussionId}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// ── Middleware ────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000", credentials: true }));
app.use(express.json());

// ── API Routes ────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/locations", locationRoutes);
app.use("/issues", issueRoutes);
app.use("/polls", pollRoutes);
app.use("/discussions", discussionRoutes);
app.use("/dashboard", dashboardRoutes);

// Debug endpoint — only in non-production environments
if (process.env.NODE_ENV !== "production") {
  app.use("/debug", debugRoutes);
  console.log("⚠️  Debug endpoints enabled (POST /debug/fast-forward/:issueId)");
}

// ── Health check ──────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Error handler ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 CivicPulse API running on http://localhost:${PORT}`);
    console.log(`🔌 Socket.io ready`);
  });
});
