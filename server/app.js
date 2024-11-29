require("dotenv").config();
require("./services/birthdayEmailService");
require("./config/mongoDb");

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const helmet = require("helmet");

const authRouter = require("./routes/auth");
const dateRouter = require("./routes/date");
const usersRouter = require("./routes/users");

const app = express();

console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

// CORS configuration
app.use(
  cors({
    credentials: true,
    origin: process.env.FRONTEND_URL || "http://localhost:3000", // Fallback to localhost during development
  })
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        fontSrc: ["'self'", "data:"], // Autorise les polices depuis `data:` et le domaine
        imgSrc: ["'self'", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Si des styles inline sont nécessaires
      },
    },
  })
);

// Middlewares
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Static files for production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "build"))); // Update if the folder name is different
}

// API routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/date", dateRouter);

// 404 Middleware for API routes
app.use("/api/*", (req, res, next) => {
  const error = new Error("Resource not found.");
  error.status = 404;
  next(error);
});

// React fallback route for production
if (process.env.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

module.exports = app;
