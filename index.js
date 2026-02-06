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
    methods: ["GET", "POST"]
  },
  transports: ["websocket"] // 🔥 FIX
});

/* 🔐 ONLINE USERS STORE (userId based) */
let users = [];

/* ================== AUTH MIDDLEWARE ================== */

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token"));

    // 🔑 SAME SECRET as login backend
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret123");

    socket.user = {
      userId: decoded.id,
      name: decoded.name
    };

    next();
  } catch (err) {
    next(new Error("Authentication failed"));
  }
});

/* ================== SOCKET CONNECTION ================== */

io.on("connection", (socket) => {
  console.log("Connected:", socket.user.userId, socket.id);

  /* ---------- ADD USER ---------- */
  users.push({
    userId: socket.user.userId,
    name: socket.user.name,
    socketId: socket.id
  });

  io.emit("online-users", users);

  /* ---------- CALL USER ---------- */
  socket.on("call-user", ({ to, signal }) => {
    const user = users.find(u => u.userId === to);

    if (user) {
      io.to(user.socketId).emit("call-user", {
        from: socket.user.userId,
        name: socket.user.name,
        signal
      });
    }
  });

  /* ---------- ANSWER CALL ---------- */
  socket.on("answer-call", ({ to, signal }) => {
    const user = users.find(u => u.userId === to);

    if (user) {
      io.to(user.socketId).emit("call-accepted", signal);
    }
  });

   socket.on("end-call", ({ to }) => {
      const userToEnd = onlineUsers[to];
      if (userToEnd) {
        io.to(userToEnd.socketId).emit("call-ended");
      }
    });

  /* ---------- DISCONNECT ---------- */
  socket.on("disconnect", () => {
    users = users.filter(u => u.socketId !== socket.id);
    io.emit("online-users", users);
    console.log("Disconnected:", socket.id);
  });
});

    /* ================= END CALL (OPTIONAL) ================= */
   

    /* ================= DISCONNECT ================= */
 


/* ================= SERVER ================= */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
