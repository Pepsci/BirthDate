require("dotenv").config();
require("./config/mongoDb");

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Même politique que le CORS Express (app.js) : les requêtes sans Origin
// (app mobile React Native, outils) sont autorisées — l'auth reste assurée
// par le middleware socketAuth (JWT obligatoire).
const allowedSocketOrigins = [
  "http://localhost:5173",
  "https://birthreminder.com",
  "https://www.birthreminder.com",
];

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin || allowedSocketOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
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
io.app = app;

// Un seul io.on("connection") — évite les doublons de listeners
io.on("connection", (socket) => {
  socket.join(`user:${socket.userId}`);
  console.log("🔍 app dans connection handler:", typeof app, !!app); // ← ajouter
  setupChatHandlers(io, socket, connectedUsers, app);
  setupEventHandlers(io, socket, app);
});
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready`);
});
