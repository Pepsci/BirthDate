const fs = require("fs");
const https = require("https");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");

const authRouter = require("./routes/auth");
const dateRouter = require("./routes/date");
const usersRouter = require("./routes/users");

const app = express();

// Vérification des variables d'environnement critiques
if (!process.env.FRONTEND_URL) {
  console.error(
    "Error: FRONTEND_URL is not defined in the environment variables."
  );
  process.exit(1);
}

console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

// Configuration de CORS
app.use(
  cors({
    credentials: true,
    origin: process.env.FRONTEND_URL,
  })
);

// Middlewares
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Routes API
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/date", dateRouter);

// Gestion des routes non trouvées
app.use("/api/*", (req, res, next) => {
  res.status(404).json({ error: "Resource not found." });
});

// En mode production, servir le frontend depuis le dossier "public"
if (process.env.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
  });
}

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error(err.message || "Internal server error");
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// Configuration HTTPS
const httpsOptions = {};
try {
  httpsOptions.key = fs.readFileSync("./localhost-key.pem");
  httpsOptions.cert = fs.readFileSync("./localhost.pem");
} catch (err) {
  console.error("Error loading SSL certificates:", err.message);
  process.exit(1);
}

// Démarrage du serveur HTTPS
https.createServer(httpsOptions, app).listen(4000, () => {
  console.log("HTTPS Server running on port 4000");
});

module.exports = app;
