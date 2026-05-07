require("dotenv").config();
require("./config/mongoDb");

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const helmet = require("helmet");

const dateStatsRouter = require("./routes/date.stats");
const authRouter = require("./routes/auth");
const dateRouter = require("./routes/date");
const usersRouter = require("./routes/users");
const verifyRouter = require("./routes/verify");
const unsubscribeRouter = require("./routes/unsubscribe");
const wishlistPublicRouter = require("./routes/wishlist.public"); // ← AVANT wishlist
const wishlistRouter = require("./routes/wishlist");
const friendRouter = require("./routes/friends");
const conversationsRouter = require("./routes/conversations");
const mergeDatesRouter = require("./routes/mergeDates");
const pushRoutes = require("./routes/push");
const eventsRouter = require("./routes/events/index");
const notificationsRouter = require("./routes/notifications");
const statsRouter = require("./routes/stats");

// Cron jobs
const purgeDeletedAccounts = require("./jobs/purgeDeletedAccounts");
const sendReminders = require("./jobs/sendReminders");
const eventReminders = require("./jobs/eventReminders");
const {
  chatCronInstant,
  chatCronTwiceDaily,
  chatCronDaily,
  chatCronWeekly,
} = require("./jobs/chatNotificationCron");

const app = express();

sendReminders.initApp(app);
eventReminders.initApp(app);

app.use(helmet());

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
    allowedHeaders:
      "Content-Type,Authorization,X-Event-Code,x-guest-token,Cache-Control",
  }),
);

// Route de stress test temporaire — à supprimer après les tests
app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});
// Token de test pour stress test — à supprimer après
const STRESS_TEST_TOKEN = "stress-test-secret-2024";

app.use("/api/stress", (req, res, next) => {
  if (req.headers["x-stress-token"] !== STRESS_TEST_TOKEN) {
    return res.status(401).json({ message: "Non autorisé" });
  }
  // Injecte un faux user pour que les routes protégées fonctionnent
  req.user = { _id: "66900bfb7335dfcd9d25b6de" }; // ton vrai _id MongoDB
  next();
});

// Route de test authentifiée qui tape MongoDB
app.get("/api/stress/dates", async (req, res) => {
  try {
    const DateModel = require("./models/date.model"); // adapte le chemin si besoin
    const dates = await DateModel.find({ user: req.user._id }).limit(20);
    res.json({ count: dates.length, ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/loaderio-bcebff5a81d031074a9b23b1ec9c73b4", (req, res) => {
  res.type("text").send("loaderio-bcebff5a81d031074a9b23b1ec9c73b4");
});
app.get("/loaderio-bcebff5a81d031074a9b23b1ec9c73b4.html", (req, res) => {
  res.type("text").send("loaderio-bcebff5a81d031074a9b23b1ec9c73b4");
});

app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/date", dateStatsRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/date", dateRouter);
app.use("/api/verify-email", verifyRouter);
app.use("/api/unsubscribe", unsubscribeRouter);
app.use("/api/wishlist/public", wishlistPublicRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/friends", friendRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/merge-dates", mergeDatesRouter);
app.use("/api/push", pushRoutes);
app.use("/api/events", eventsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/stats", statsRouter);

// Cron jobs
purgeDeletedAccounts.start();
sendReminders.start();
eventReminders.start();
chatCronInstant.start();
chatCronDaily.start();
chatCronTwiceDaily.start();
chatCronWeekly.start();

console.log("🤖 Cron jobs activés :");
console.log("   ✅ Purge comptes supprimés (tous les jours à 3h)");
console.log("   ✅ Emails anniversaires & fêtes (tous les jours à minuit)");
console.log("   ✅ Emails rappels événements (tous les jours à 6h)");
console.log("   ✅ Emails chat instantané (toutes les 5 minutes)");
console.log("   ✅ Emails chat quotidien (tous les jours à 9h)");
console.log("   ✅ Emails chat hebdomadaire (chaque lundi à 9h)");

app.use("/api/*", (req, res, next) => {
  res.status(404).json({ message: "Ressource API non trouvée." });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "public")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });
}

module.exports = app;
