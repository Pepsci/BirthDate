// diagnose-push-duplicates.js
//
// Compte les canaux de notification enregistrés pour un utilisateur.
//
// ── Pourquoi ────────────────────────────────────────────────────────────────
// Recevoir DEUX notifications sur le téléphone pour un seul rappel, alors que
// le centre de notifications de l'application n'en montre qu'une, ne peut pas
// venir du code qui envoie : celui-ci n'appelle `notify()` qu'une fois par
// rappel, et c'est `notify()` qui crée la ligne unique qu'on voit sur le web.
//
// Le doublon vient donc de la LIVRAISON : le serveur envoie à tous les canaux
// enregistrés pour le compte. Deux canaux qui aboutissent au même appareil
// produisent deux bannières. Les deux cas courants :
//
//   1. plusieurs jetons Expo — une réinstallation, un build TestFlight à côté
//      d'un build de développement, et l'ancien jeton reste valide ;
//   2. un abonnement web push (la version installée depuis Safari/Chrome) EN
//      PLUS de l'application native, sur le même téléphone.
//
// Ce script ne modifie rien. Il affiche ce qui est enregistré, pour trancher.
//
// ── Usage ───────────────────────────────────────────────────────────────────
//   node scripts/diagnose-push-duplicates.js <email>
//   node scripts/diagnose-push-duplicates.js <email> --prune-expo
//   node scripts/diagnose-push-duplicates.js <email> --prune-web=2
//   node scripts/diagnose-push-duplicates.js <email> --test-push
//   node scripts/diagnose-push-duplicates.js <email> --notifs
//   node scripts/diagnose-push-duplicates.js <email> --card=Louise
//
// `--prune-expo` ne garde que le jeton Expo le plus récent (le dernier de la
// liste). À n'utiliser QUE si le diagnostic montre plusieurs jetons pour une
// personne qui n'a qu'un seul téléphone.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const email = process.argv[2];
const prune = process.argv.includes("--prune-expo");
// `--prune-web=N` retire l'abonnement web push numéro N de la liste affichée.
//
// ⚠️ Nécessaire parce qu'un abonnement mort ne se nettoie pas toujours tout
// seul. Le code d'envoi supprime bien ceux que le service de push refuse
// (404/410), mais un abonnement posé par une version web depuis désinstallée
// peut rester ACCEPTÉ pendant des mois : le service continue de livrer, et
// l'utilisateur reçoit une notification par un canal qu'il croyait supprimé,
// sans plus aucun écran pour le retirer.
// `--test-push` envoie une notification de test par le VRAI chemin d'envoi
// (services/pushService). C'est le seul moyen de trancher sans attendre le
// prochain rappel : on compte ce qui arrive réellement sur les appareils.
// `--notifs` liste ce que le serveur a réellement ÉCRIT, et les cartes en
// double pour une même personne.
//
// ⚠️ C'est la question qui tranche. Deux bannières sur le téléphone peuvent
// venir de deux canaux de livraison OU de deux envois. Si la base contient
// deux notifications, c'est le second cas, et la cause est en amont : deux
// cartes pour la même personne, ou une préférence de rappel enregistrée en
// double (« J-3 » présent deux fois dans les timings suffit à tout doubler).
// `--card=<prenom>` liste TOUTES les cartes portant ce prenom, quelle que soit
// la facon dont il est porte.
//
// ⚠️ Une carte rattachee a un ami peut avoir son champ `name` VIDE et tirer son
// prenom de l'ami. Comparer `name` seul, comme le faisait la detection de
// doublons ci-dessus, rate donc exactement le cas le plus frequent : une carte
// saisie a la main, puis la meme personne ajoutee en ami.
const cardArg = process.argv.find((a) => a.startsWith("--card="));
const cardName = cardArg ? cardArg.split("=")[1].toLowerCase() : null;
const showNotifs = process.argv.includes("--notifs");
const testPush = process.argv.includes("--test-push");
const pruneWebArg = process.argv.find((a) => a.startsWith("--prune-web="));
const pruneWebIndex = pruneWebArg
  ? Number(pruneWebArg.split("=")[1])
  : null;

if (!email) {
  console.error("Usage : node scripts/diagnose-push-duplicates.js <email>");
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error(
    "MONGO_URI absent. Lancez ce script depuis le dossier server/, où se trouve le .env.",
  );
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const User = require("../models/user.model");
  const PushSubscription = require("../models/PushSubscription.model");

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "email pushEnabled pushEvents expoPushTokens expoPushTokensIos",
  );

  if (!user) {
    console.error(`Aucun compte pour ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const expo = user.expoPushTokens || [];
  // `endpoint` est imbriqué sous `subscription`, et `userAgent` est ce qui
  // permet de reconnaître QUEL appareil a posé l'abonnement — c'est toute la
  // question ici.
  const webSubs = await PushSubscription.find({ user: user._id }).select(
    "subscription.endpoint userAgent createdAt",
  );

  console.log(`\nCompte : ${user.email}`);
  console.log(`  pushEnabled : ${user.pushEnabled}`);
  console.log(`  categories  : ${JSON.stringify(user.pushEvents || {})}`);

  console.log(`\nJetons Expo (application native) : ${expo.length}`);
  expo.forEach((t, i) => {
    const ios = (user.expoPushTokensIos || []).includes(t);
    console.log(`  ${i + 1}. ${t}${ios ? "  [iOS]" : ""}`);
  });

  console.log(`\nAbonnements web push (navigateur / PWA) : ${webSubs.length}`);
  webSubs.forEach((s, i) => {
    const ep = s.subscription?.endpoint || "(endpoint absent)";
    const host = ep.startsWith("http") ? new URL(ep).host : ep;
    const ua = s.userAgent || "appareil inconnu";
    // L'agent est long : on n'en garde que ce qui identifie l'appareil.
    const device = /iPhone|iPad|Android|Macintosh|Windows/.exec(ua)?.[0] || ua.slice(0, 40);
    console.log(
      `  ${i + 1}. ${device}  via ${host}  (${s.createdAt?.toISOString?.().slice(0, 10) ?? "date inconnue"})`,
    );
    console.log(`     ${ep.slice(0, 70)}…`);
  });

  const channels = expo.length + webSubs.length;
  console.log(
    `\n=> ${channels} canal/canaux : chaque rappel produit ${channels} notification(s) sur les appareils.`,
  );
  if (channels > 1) {
    console.log(
      "   Si ces canaux aboutissent au même téléphone, c'est la cause du doublon.",
    );
  }

  if (webSubs.length && expo.length) {
    console.log(
      "\nUn abonnement web push posé depuis le MÊME téléphone que l'application",
    );
    console.log(
      "native donne deux notifications pour un seul rappel. Repérez-le à son",
    );
    console.log(
      "appareil ci-dessus, et retirez-le depuis ce navigateur : Profil →",
    );
    console.log("Notifications → Push → Désactiver.");
  }

  if (cardName) {
    const dateModel = require("../models/date.model");
    const all = await dateModel
      .find({ owner: user._id })
      .populate("linkedUser", "name surname birthDate")
      .select(
        "name surname date receiveNotifications notificationPreferences linkedUser family createdAt",
      );

    const matches = all.filter((d) => {
      const shown = `${d.name || d.linkedUser?.name || ""} ${d.surname || d.linkedUser?.surname || ""}`;
      return shown.toLowerCase().includes(cardName);
    });

    console.log(`\nCartes correspondant a "${cardName}" : ${matches.length}`);
    matches.forEach((d, i) => {
      const shown =
        `${d.name || d.linkedUser?.name || ""} ${d.surname || d.linkedUser?.surname || ""}`.trim();
      const born = d.date
        ? new Date(d.date).toISOString().slice(0, 10)
        : "(pas de date)";
      console.log(`  ${i + 1}. ${d._id}`);
      console.log(
        `     affiche      : "${shown}"   (name="${d.name || ""}" surname="${d.surname || ""}")`,
      );
      console.log(`     naissance    : ${born}`);
      console.log(
        `     lien ami     : ${d.linkedUser ? `${d.linkedUser.name} ${d.linkedUser.surname || ""} (${d.linkedUser._id})` : "aucun"}`,
      );
      console.log(
        `     rappels      : timings=${JSON.stringify(d.notificationPreferences?.timings)} notifyOnBirthday=${d.notificationPreferences?.notifyOnBirthday}`,
      );
      console.log(
        `     notifications: receiveNotifications=${d.receiveNotifications}`,
      );
      console.log(`     creee le     : ${d.createdAt?.toISOString?.().slice(0, 10) ?? "?"}`);
    });
  }

  if (showNotifs) {
    const Notification = require("../models/notification.model");
    const dateModel = require("../models/date.model");

    const notifs = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(15)
      .select("type data createdAt read");

    /*
     * Un ObjectId n'est pas qu'un identifiant : c'est une empreinte du
     * processus qui l'a créé.
     *
     *   [ 4 octets : horodatage ][ 5 octets : machine + processus ][ 3 : compteur ]
     *
     * Les 5 octets du milieu sont tirés au hasard UNE fois par processus et ne
     * changent plus. Deux documents écrits par le même processus les partagent
     * donc, avec des compteurs qui se suivent ; deux documents écrits par deux
     * processus différents ont deux empreintes différentes.
     *
     * C'est ce qui permet de répondre sans les logs : deux rappels identiques
     * portant deux empreintes distinctes ont été écrits par DEUX serveurs.
     */
    console.log("\n15 dernieres notifications ECRITES en base :");
    notifs.forEach((n) => {
      const when = n.createdAt.toISOString().replace("T", " ").slice(0, 23);
      const who = n.data?.name || n.data?.eventTitle || n.data?.giftName || "";
      const extra =
        n.data?.daysLeft !== undefined ? ` J-${n.data.daysLeft}` : "";
      const hex = n._id.toString();
      console.log(
        `  ${when}  ${n.type}${extra}  ${who}\n      processus=${hex.slice(8, 18)}  compteur=${hex.slice(18, 24)}`,
      );
    });

    // Verdict automatique sur les rappels d'anniversaire du meme jour.
    const byKey = new Map();
    for (const n of notifs) {
      if (n.type !== "birthday_soon") continue;
      const key = `${n.data?.name}|${n.data?.daysLeft}|${n.createdAt.toISOString().slice(0, 10)}`;
      byKey.set(key, [...(byKey.get(key) || []), n]);
    }
    for (const [key, group] of byKey) {
      if (group.length < 2) continue;
      const procs = new Set(group.map((n) => n._id.toString().slice(8, 18)));
      const ecart =
        Math.abs(group[0].createdAt - group[group.length - 1].createdAt) / 1000;
      console.log(`\n  >>> ${group.length} rappels identiques : ${key}`);
      console.log(`      empreintes de processus distinctes : ${procs.size}`);
      console.log(`      ecart entre le premier et le dernier : ${ecart} s`);
      console.log(
        procs.size > 1
          ? "      => DEUX processus ont ecrit. Un second serveur tournait sur cette base."
          : "      => UN SEUL processus a ecrit deux fois. La cause est dans le code du job.",
      );
    }

    // Cartes en double : même nom, même jour/mois de naissance.
    const dates = await dateModel
      .find({ owner: user._id })
      .select("name surname date linkedUser notificationPreferences");
    const seen = new Map();
    for (const d of dates) {
      if (!d.date) continue;
      const key = `${(d.name || "").toLowerCase().trim()}|${new Date(d.date).getMonth()}-${new Date(d.date).getDate()}`;
      seen.set(key, [...(seen.get(key) || []), d]);
    }
    const dupes = [...seen.entries()].filter(([, v]) => v.length > 1);
    console.log(`\nCartes en double (meme prenom, meme jour) : ${dupes.length}`);
    for (const [key, group] of dupes) {
      console.log(`  ${key.split("|")[0]} → ${group.length} cartes`);
      group.forEach((d) =>
        console.log(
          `     ${d._id}  ${d.name} ${d.surname || ""}  ${d.linkedUser ? "[ami]" : "[manuelle]"}  timings=${JSON.stringify(d.notificationPreferences?.timings)}`,
        ),
      );
    }

    // Rappels enregistres en double sur une meme carte.
    const badTimings = dates.filter((d) => {
      const t = d.notificationPreferences?.timings || [];
      return new Set(t).size !== t.length;
    });
    console.log(
      `\nCartes dont les rappels contiennent un doublon : ${badTimings.length}`,
    );
    badTimings.forEach((d) =>
      console.log(
        `  ${d.name} ${d.surname || ""} → ${JSON.stringify(d.notificationPreferences.timings)}`,
      ),
    );
  }

  if (testPush) {
    const { sendPushToUser } = require("../services/pushService");
    const stamp = new Date().toLocaleTimeString("fr-FR");
    console.log("\nEnvoi d'une notification de test sur tous les canaux…");
    await sendPushToUser(user._id, {
      title: "Test BirthReminder",
      body: `Envoi unique de ${stamp} — comptez combien vous en recevez.`,
      url: "/home",
      tag: `diagnostic-${Date.now()}`,
      type: "default",
    });
    // L'envoi Expo est lancé sans être attendu par sendPushToUser : on laisse
    // le temps à la requête HTTP de partir avant de fermer le processus.
    await new Promise((r) => setTimeout(r, 3000));
    console.log(
      "Envoyé. Une seule notification reçue par appareil = tout va bien.",
    );
  }

  if (pruneWebIndex) {
    const target = webSubs[pruneWebIndex - 1];
    if (!target) {
      console.error(
        `\nAucun abonnement web push n° ${pruneWebIndex} — il y en a ${webSubs.length}.`,
      );
    } else {
      await PushSubscription.deleteOne({ _id: target._id });
      console.log(
        `\nAbonnement web push n° ${pruneWebIndex} supprimé (${target.userAgent || "appareil inconnu"}).`,
      );
      console.log(
        "Ce canal ne recevra plus rien. Réinstaller la version web en recréerait un.",
      );
    }
  }

  if (prune && expo.length > 1) {
    const keep = expo[expo.length - 1];
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          expoPushTokens: [keep],
          expoPushTokensIos: (user.expoPushTokensIos || []).includes(keep)
            ? [keep]
            : [],
        },
      },
    );
    console.log(`\nJetons Expo réduits au plus récent : ${keep}`);
    console.log(
      "L'appareil réenregistrera son jeton au prochain lancement de l'application.",
    );
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error("Erreur :", err.message);
  process.exit(1);
});
