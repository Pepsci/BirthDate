require("dotenv").config();
require("./config/mongoDb");

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://birthreminder.com",
      "https://www.birthreminder.com",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const socketAuthMiddleware = require("./middleware/socketAuth");
io.use(socketAuthMiddleware);

const setupChatHandlers = require("./sockets/chatHandlers");
const setupEventHandlers = require("./sockets/eventHandlers");

// Map partagée entre les deux handlers et les routes HTTP
const connectedUsers = new Map();
app.set("io", io);
app.set("connectedUsers", connectedUsers);

// Un seul io.on("connection") — évite les doublons de listeners
io.on("connection", (socket) => {
  setupChatHandlers(io, socket, connectedUsers);
  setupEventHandlers(io, socket);
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready`);
});