require("dotenv").config();
require("./services/birthdayEmailService");
require("./config/mongoDb");

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
    methods: "GET,POST,OPTIONS,PUT,DELETE,PATCH",
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

app.use("/api/*", (req, res, next) => {
  res.status(404).json({ message: "Ressource API non trouvée." });
});

if (process.env.NODE_ENV === "production") {
  app.use("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
  });
}

module.exports = app;
