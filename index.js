const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");
const User = require("./models/User");
const { Server } = require("socket.io");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Video Call Backend Running");
});

// routes
app.use("/api/auth", require("./routes/authRoutes"));

/* 🔥 SOCKET.IO INIT */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/* 🔐 ONLINE USERS STORE (userId based) */
let onlineUsers = {};

/* 🔥 SOCKET CONNECTION */
io.on("connection", async (socket) => {
  try {
    /* ================= AUTH ================= */
    const token = socket.handshake.auth?.token;
    if (!token) {
      console.log("❌ No token");
      return socket.disconnect();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("name email");

    if (!user) {
      console.log("❌ User not found");
      return socket.disconnect();
    }

    console.log("✅ User connected:", user.name);

    /* ================= SAVE ONLINE USER ================= */
    onlineUsers[user._id] = {
      userId: user._id.toString(),
      name: user.name,
      socketId: socket.id,
    };

    /* ================= SEND ONLINE USERS ================= */
    io.emit("online-users", Object.values(onlineUsers));

    /* ================= CALL USER ================= */
    socket.on("call-user", ({ to, signal }) => {
      const receiver = onlineUsers[to];

      if (receiver) {
        io.to(receiver.socketId).emit("call-user", {
          from: user._id.toString(),
          name: user.name,
          signal,
        });
      }
    });

    /* ================= ANSWER CALL ================= */
    socket.on("answer-call", ({ to, signal }) => {
      const caller = onlineUsers[to];

      if (caller) {
        io.to(caller.socketId).emit("call-accepted", signal);
      }
    });

    /* ================= END CALL (OPTIONAL) ================= */
    socket.on("end-call", ({ to }) => {
      const userToEnd = onlineUsers[to];
      if (userToEnd) {
        io.to(userToEnd.socketId).emit("call-ended");
      }
    });

    /* ================= DISCONNECT ================= */
    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", user.name);
      delete onlineUsers[user._id];
      io.emit("online-users", Object.values(onlineUsers));
    });

  } catch (error) {
    console.log("❌ Socket auth error:", error.message);
    socket.disconnect();
  }
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
