require("dotenv").config();
require("./config/mongoDb"); // Charger MongoDB EN PREMIER
// Attendre que la connexion soit établie avant de charger le service
setTimeout(() => {
  require("./services/birthdayEmailService");
}, 2000);

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");

const authRouter = require("./routes/auth");
const dateRouter = require("./routes/date");
const usersRouter = require("./routes/users");
const verifyRouter = require("./routes/verify");
const unsubscribeRouter = require("./routes/unsubscribe");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://birthreminder.com",
  "https://www.birthreminder.com",
];

app.use(
  cors({
    credentials: true,
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization",
  })
);

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/date", dateRouter);
app.use("/api/verify-email", verifyRouter);
app.use("/api/unsubscribe", unsubscribeRouter);

// IMPORTANT : Cette route doit rester AVANT le wildcard
app.use("/api/*", (req, res, next) => {
  res.status(404).json({ message: "Ressource API non trouvée." });
});

// MODIFICATION : Servir le frontend React pour toutes les routes NON-API
if (process.env.NODE_ENV === "production") {
  // Servir les fichiers statiques du build React
  app.use(express.static(path.join(__dirname, "public")));

  // Pour toutes les autres routes (non-API), servir index.html
  // Cela permet au React Router de gérer les routes côté client
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });
}

module.exports = app;
