// backend/server.js (nouveau fichier)
require("dotenv").config();
require("./config/mongoDb");

// Attendre que la connexion soit établie avant de charger le service
setTimeout(() => {
  require("./services/birthdayEmailService");
}, 2000);

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app"); // On importe l'app Express

const PORT = process.env.PORT || 3000;

// Créer le serveur HTTP
const server = http.createServer(app);

// Configuration Socket.io
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

// Middleware d'authentification Socket.io
const socketAuthMiddleware = require("./middleware/socketAuth");
io.use(socketAuthMiddleware);

// Gestion des événements Socket.io
const setupSocketHandlers = require("./sockets/chatHandlers");
setupSocketHandlers(io);

// Démarrer le serveur
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready`);
});
