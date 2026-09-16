// diagnose-android-push.js
//
// Trouve OÙ se perd une push Android. La chaîne a trois maillons :
//   serveur → Expo (ticket) → Google FCM (reçu) → appareil
//
// ── Pourquoi ce script ──────────────────────────────────────────────────────
// pushService ne lit que les TICKETS d'Expo. Un ticket « ok » veut seulement
// dire qu'Expo a accepté la push, pas que Google l'a livrée. Les erreurs FCM
// (clé de service manquante, mauvais projet Firebase…) n'apparaissent que
// dans les REÇUS, qu'on ne consultait jamais : la push disparaissait sans
// laisser de trace.
//
// Le script envoie deux push à chaque jeton Android du compte :
//   1. VISIBLE (titre + texte) → Android l'affiche seul, sans code de l'app.
//      Si elle n'arrive pas : problème Expo / FCM / réglages du téléphone.
//   2. DATA-ONLY chiffrée factice → réveille la tâche de fond de l'app
//      (notif-decrypt.ts). Elle n'affichera rien (chiffré invalide), mais
//      Metro doit logguer « [notif-decrypt] déchiffrement impossible ».
//      Si 1 arrive et pas ce log : c'est la tâche de fond.
// Puis il attend et affiche les reçus FCM.
//
// Ne modifie rien en base.
//
// ── Usage ───────────────────────────────────────────────────────────────────
//   node scripts/diagnose-android-push.js <email>

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const axios = require("axios");

const email = process.argv[2];
if (!email) {
  console.error("Usage : node scripts/diagnose-android-push.js <email>");
  process.exit(1);
}

const EXPO = "https://exp.host/--/api/v2/push";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require("../models/user.model");
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "email pushEnabled pushEvents expoPushTokens expoPushTokensIos",
  );
  if (!user) {
    console.error(`Aucun compte pour ${email}`);
    process.exit(1);
  }

  const ios = new Set(user.expoPushTokensIos || []);
  const android = (user.expoPushTokens || []).filter((t) => !ios.has(t));

  console.log(`\nCompte      : ${user.email}`);
  console.log(`pushEnabled : ${user.pushEnabled}`);
  console.log(`chat        : ${user.pushEvents?.chat !== false}`);
  console.log(`Jetons iOS  : ${ios.size}`);
  console.log(`Jetons Android (${android.length}) :`);
  android.forEach((t) => console.log(`  - ${t}`));

  if (user.pushEnabled !== true) {
    console.log("\n❌ pushEnabled n'est pas true : pushService n'envoie RIEN à ce compte.");
  }
  if (!android.length) {
    console.log("\n❌ Aucun jeton Android : l'app n'a jamais enregistré ce téléphone.");
    await mongoose.disconnect();
    return;
  }

  const messages = android.flatMap((to) => [
    {
      to,
      priority: "high",
      title: "🧪 Test visible",
      body: "Si tu lis ça, Expo → FCM → téléphone fonctionne.",
      sound: "default",
      channelId: "default",
      data: { type: "default", url: "/home" },
    },
    {
      to,
      priority: "high",
      _contentAvailable: true,
      data: {
        type: "chat",
        encrypted: true,
        cipher: "dGVzdA==",
        senderPublicKey: "dGVzdA==",
        senderName: "Test data-only",
      },
    },
  ]);

  const { data } = await axios.post(`${EXPO}/send`, messages, {
    headers: { "Content-Type": "application/json" },
    timeout: 10000,
  });
  const tickets = data?.data || [];
  console.log("\nTickets Expo :");
  const ids = [];
  tickets.forEach((t, i) => {
    const label = i % 2 === 0 ? "visible  " : "data-only";
    if (t.status === "ok") {
      console.log(`  ✅ ${label} accepté (id ${t.id})`);
      ids.push(t.id);
    } else {
      console.log(`  ❌ ${label} refusé : ${t.message} ${JSON.stringify(t.details || {})}`);
    }
  });

  if (ids.length) {
    console.log("\nAttente des reçus FCM (15 s)…");
    await sleep(15000);
    const { data: rec } = await axios.post(
      `${EXPO}/getReceipts`,
      { ids },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 },
    );
    const receipts = rec?.data || {};
    console.log("Reçus :");
    ids.forEach((id) => {
      const r = receipts[id];
      if (!r) console.log(`  ⏳ ${id} : pas encore de reçu (relancer plus tard)`);
      else if (r.status === "ok") console.log(`  ✅ ${id} : livré à FCM`);
      else
        console.log(`  ❌ ${id} : ${r.message} ${JSON.stringify(r.details || {})}`);
    });
  }

  console.log(`
Lecture :
  • Reçu ❌ InvalidCredentials      → clé FCM V1 absente/mauvaise (eas credentials)
  • Reçu ❌ DeviceNotRegistered     → jeton périmé : relancer l'app
  • Reçus ✅ mais rien sur le tél.  → réglages Android (notifs de l'app, batterie)
  • Visible reçue, pas de log [notif-decrypt] dans Metro → tâche de fond`);
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error("Erreur :", e.response?.data || e.message);
  await mongoose.disconnect();
  process.exit(1);
});
