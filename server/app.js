require("dotenv").config();
require("./services/birthdayEmailService");
require("./config/mongoDb");

console.log("TOKEN_SECRET:", process.env.TOKEN_SECRET);

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");

const authRouter = require("./routes/auth");
const dateRouter = require("./routes/date");
const usersRouter = require("./routes/users");
const verifyRouter = require("./routes/verify");

const app = express();

console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

app.use((req, res, next) => {
  console.log(`📥 Requête reçue: ${req.method} ${req.url}`);
  next();
});

app.use(
  cors({
    credentials: true,
    origin: ["https://birthreminder.com", "https://www.birthreminder.com"],
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

app.use("/api/*", (req, res, next) => {
  console.log(`📥 Requête reçue: ${req.method} ${req.url}`);

  const error = new Error("Ressource not found.");
  error.status = 404;
  next(error);
});

if (process.env.NODE_ENV === "production") {
  app.use("*", (req, res, next) => {
    // If no routes match, send them the React HTML.
    res.sendFile(path.join(__dirname, "public/index.html"));
  });
}

module.exports = app;
