require("dotenv").config();
require("./config/mongoDb");

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("./middleware/sanitize");
const { AVATAR_DIR, AVATAR_PUBLIC_PATH } = require("./config/avatarStorage");
const {
  CARD_PHOTO_DIR,
  CARD_PHOTO_PUBLIC_PATH,
} = require("./config/cardPhotoStorage");

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
const stripeConnectRouter = require("./routes/stripe.connect");
const stripeWebhookRouter = require("./routes/stripe.webhook");

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

// Derrière nginx : nécessaire pour que req.ip / le rate-limit lisent la vraie IP
app.set("trust proxy", 1);

sendReminders.initApp(app);
eventReminders.initApp(app);

app.use(helmet());

// Rate-limit global sur l'API (garde-fou anti brute-force / énumération / abus)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Trop de requêtes. Réessayez plus tard." },
});

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

//Route test Loader.io
app.get("/loaderio-bcebff5a81d031074a9b23b1ec9c73b4", (req, res) => {
  res.type("text").send("loaderio-bcebff5a81d031074a9b23b1ec9c73b4");
});
app.get("/loaderio-bcebff5a81d031074a9b23b1ec9c73b4.html", (req, res) => {
  res.type("text").send("loaderio-bcebff5a81d031074a9b23b1ec9c73b4");
});

// ⚠️ Webhook Stripe : DOIT être monté AVANT express.json().
// Stripe vérifie la signature sur le body brut -> express.raw() ici uniquement.
app.use(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookRouter,
);

// Logs verbeux uniquement hors production
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.url}`);
    next();
  });
  app.use(logger("dev"));
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// ── Avatars uploadés ────────────────────────────────────────────────────────
// En production nginx intercepte /uploads/ avant Node (voir deploy/nginx-avatars.conf).
// Ce montage sert donc surtout le dev, et fait filet de sécurité en prod.
//
// Cross-Origin-Resource-Policy : helmet() pose `same-origin` par défaut, ce qui
// bloquerait le chargement des images depuis le front en dev (5173 → 4000).
app.use(
  AVATAR_PUBLIC_PATH,
  express.static(AVATAR_DIR, {
    maxAge: "1y",
    immutable: true,
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

// ── Photos de carte (dates manuelles) ──────────────────────────────────────
// Même principe que les avatars ci-dessus. En prod, voir
// deploy/nginx-card-photos.conf pour le montage nginx.
app.use(
  CARD_PHOTO_PUBLIC_PATH,
  express.static(CARD_PHOTO_DIR, {
    maxAge: "1y",
    immutable: true,
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

// Sanitisation anti-injection NoSQL sur toutes les entrées
app.use(mongoSanitize);

// Rate-limit global sur l'API
app.use("/api", generalLimiter);

app.use("/api/date", dateStatsRouter);
app.use("/api/auth", authRouter);
// Export RGPD monté AVANT usersRouter : /me/export ne doit pas être capté
// par une route paramétrée du routeur principal.
app.use("/api/users", require("./routes/users.export"));
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
app.use("/api/stripe/connect", stripeConnectRouter);
app.use("/api/support", require("./routes/support"));
app.use("/api/moderation", require("./routes/moderation"));
app.use("/api/shared-gifts", require("./routes/sharedGifts"));
app.use("/api/admin", require("./routes/admin/index"));

// Cron jobs
purgeDeletedAccounts.start();
require("./jobs/purgeClearedConversations").start();
sendReminders.start();
eventReminders.start();
require("./jobs/poolFraudAlerts").start();
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
console.log("   ✅ Contrôle anti-fraude cagnottes (tous les jours à 8h)");

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
