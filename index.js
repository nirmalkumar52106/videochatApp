const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");
const User = require("./models/User"); // ✅ path check kar lena
const { Server } = require("socket.io");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hey users");
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

/* 🔹 AUTHENTICATED ONLINE USERS */
let onlineUsers = {};

/* 🔥 SOCKET CONNECTION */
io.on("connection", async (socket) => {
  try {
    // 🔐 token frontend se aayega
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log("No token, disconnecting");
      return socket.disconnect();
    }

    // verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("name email");
    if (!user) {
      console.log("User not found");
      return socket.disconnect();
    }

    console.log("User connected:", user.name);

    // store authenticated user
    onlineUsers[user._id] = {
      userId: user._id,
      name: user.name,
      socketId: socket.id,
    };

    // send online registered users only
    io.emit("online-users", Object.values(onlineUsers));

    /* 📞 CALL USER */
    socket.on("call-user", ({ to, signal }) => {
      if (onlineUsers[to]) {
        io.to(onlineUsers[to].socketId).emit("call-user", {
          from: user._id,
          name: user.name,
          signal,
        });
      }
    });

    /* ☎️ ANSWER CALL */
    socket.on("answer-call", ({ to, signal }) => {
      if (onlineUsers[to]) {
        io.to(onlineUsers[to].socketId).emit("call-accepted", signal);
      }
    });

    /* ❌ DISCONNECT */
    socket.on("disconnect", () => {
      delete onlineUsers[user._id];
      io.emit("online-users", Object.values(onlineUsers));
      console.log("User disconnected:", user.name);
    });

  } catch (error) {
    console.log("Socket auth error");
    socket.disconnect();
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
