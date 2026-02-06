const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const { Server } = require("socket.io");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

/* 🔥 SOCKET.IO INIT (MISSING PART FIXED) */
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// routes
app.use("/api/auth", require("./routes/authRoutes"));

/* 🔹 SOCKET USERS STORE */
let users = {};

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    users[socket.id] = socket.id;

    // send updated users list
    io.emit("online-users", Object.keys(users));

    socket.on("call-user", (data) => {
        io.to(data.to).emit("call-user", {
            from: socket.id,
            signal: data.signal
        });
    });

    socket.on("answer-call", (data) => {
        io.to(data.to).emit("call-accepted", data.signal);
    });

    socket.on("disconnect", () => {
        delete users[socket.id];
        io.emit("online-users", Object.keys(users));
        console.log("User disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
