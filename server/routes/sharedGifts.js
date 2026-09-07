const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const SharedGiftList = require("../models/sharedGiftList.model");
const SharedGiftListInvitation = require("../models/sharedGiftListInvitation.model");
const DateModel = require("../models/date.model");
const User = require("../models/user.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const { notify } = require("../utils/notify");
const { sendPushToUser } = require("../services/pushService");
const { isBlockedBetween } = require("../utils/blocking");
const { nanoid } = require("nanoid");

const personLabel = (dateDoc) =>
  `${dateDoc?.name || ""} ${dateDoc?.surname || ""}`.trim() || "quelqu'un";

/**
 * Lien de notification vers une liste commune, résolu POUR UN MEMBRE DONNÉ.
 *
 * Une liste commune n'a pas d'écran à elle : elle s'affiche dans l'onglet
 * « Liste commune » d'une carte. Or chaque membre la pose sur SA carte
 * (Date.sharedGiftList), donc le bon lien dépend du destinataire.
 *
 * Repli sur l'écran de rattachement quand aucune carte ne porte la liste : le
 * cas normal est couvert à l'acceptation de l'invitation (qui relie la carte
 * choisie), mais un membre peut avoir supprimé cette carte depuis, et un
 * "viewer" (accès en consultation) n'en a jamais eu.
 */
async function sharedListLinkFor(userId, listId) {
  try {
    const myCard = await DateModel.findOne({
      owner: userId,
      sharedGiftList: listId,
    }).select("_id");
    if (myCard) return `/home?tab=date&dateId=${myCard._id}`;
  } catch {
    // Résolution impossible : on retombe sur le rattachement, jamais sur une
    // notification sans lien.
  }
  return `/shared-list/${listId}/attach`;
}

/**
 * Prévient les membres d'une liste commune d'une activité, SAUF son auteur :
 * personne n'a besoin d'être notifié de sa propre action.
 *
 * Jusqu'ici seules l'invitation et l'acceptation notifiaient. Ajouter, modifier
 * ou retirer une idée se faisait en silence : les autres membres ne
 * découvraient le changement qu'en rouvrant la liste, au risque d'acheter deux
 * fois le même cadeau — ce que la liste commune est censée éviter.
 *
 * Le push part sur la catégorie "gifts" : ces notifications suivent donc
 * l'interrupteur « Cadeaux » de Notifications push, sans nouveau réglage à
 * faire découvrir à l'utilisateur.
 *
 * Jamais bloquant : une notification qui échoue ne doit pas faire échouer
 * l'action, déjà enregistrée en base quand on arrive ici.
 */
async function notifyOtherMembers(
  app,
  list,
  actorId,
  { type, data, pushTitle, pushBody, alsoViewers = [] },
) {
  const others = (list.members || []).filter(
    (m) => m && m.toString() !== actorId.toString(),
  );

  // ── Invités ───────────────────────────────────────────────────────────────
  // Ils ne reçoivent PAS tout : un invité n'a pas à suivre chaque changement
  // de statut d'une liste qui ne lui appartient pas. L'appelant décide, cas par
  // cas, lesquels concerner — en pratique l'ajout d'une idée (il peut vouloir
  // s'en charger) et le retrait d'un cadeau qu'il avait réservé (il comptait
  // dessus). D'où cette liste explicite plutôt qu'un booléen.
  const recipients = [...others, ...alsoViewers].filter(
    (id) => id && id.toString() !== actorId.toString(),
  );

  // Dédoublonnage : un même identifiant pourrait figurer dans les deux listes.
  const seen = new Set();
  for (const rawId of recipients) {
    const userId = rawId.toString();
    if (seen.has(userId)) continue;
    seen.add(userId);

    // ⚠️ try/catch PAR DESTINATAIRE. Il englobait toute la boucle : un échec
    // sur le premier (token push mort, utilisateur supprimé) privait tous les
    // suivants de leur notification, sans que rien ne le signale.
    try {
      // Lien PAR DESTINATAIRE. Une liste commune est posée sur une carte
      // différente chez chaque membre (Date.sharedGiftList), donc il n'existe
      // pas de lien unique valable pour tous : c'est pour ça que le lien était
      // jusqu'ici "/home?tab=friends", qui renvoyait tout le monde sur la
      // liste d'amis au lieu de la liste de cadeaux concernée.
      const link = await sharedListLinkFor(userId, list._id);
      await notify(app, { userId, type, data, link });
      await sendPushToUser(userId, {
        title: pushTitle,
        body: pushBody,
        url: link,
        tag: `shared-list-${list._id}`,
        type: "shared_list",
      });
    } catch (err) {
      console.error(
        `❌ Notification liste commune échouée pour ${userId}:`,
        err.message,
      );
    }
  }
}

/** Identifiants des invités (viewers) d'une liste. */
const viewerIds = (list) =>
  (list.viewers || []).filter((v) => v && v.user).map((v) => v.user);

/** Nom de l'auteur de l'action, pour le texte des notifications. */
async function actorName(userId) {
  try {
    const u = await User.findById(userId).select("name surname");
    return `${u?.name || ""} ${u?.surname || ""}`.trim() || "Quelqu'un";
  } catch {
    return "Quelqu'un";
  }
}

// ── Inviter un ami à créer une liste commune ────────────────────────────────
router.post("/invite", isAuthenticated, async (req, res) => {
  try {
    const { friendId, dateId, mode, giftIds } = req.body;
    if (!mongoose.isValidObjectId(friendId) || !mongoose.isValidObjectId(dateId))
      return res.status(400).json({ message: "Paramètres invalides" });
    if (friendId === req.payload._id)
      return res.status(400).json({ message: "Choisis un autre membre" });

    // Modération : refus silencieux si l'un des deux a bloqué l'autre. On
    // renvoie une invitation factice `already` pour que l'UI affiche « déjà
    // envoyée » sans révéler le blocage.
    if (await isBlockedBetween(req.payload._id, friendId))
      return res.status(200).json({ invitation: null, already: true });

    const date = await DateModel.findOne({
      _id: dateId,
      owner: req.payload._id,
    });
    if (!date) return res.status(404).json({ message: "Carte introuvable" });

    // Mode de partage : "full" (défaut) ou "selective" avec une liste d'idées
    const shareMode = mode === "selective" ? "selective" : "full";
    const validGiftIds =
      shareMode === "selective" && Array.isArray(giftIds)
        ? giftIds.filter((id) => mongoose.isValidObjectId(id))
        : [];
    if (shareMode === "selective" && validGiftIds.length === 0)
      return res
        .status(400)
        .json({ message: "Sélectionne au moins une idée à partager." });

    // Évite les doublons d'invitation en attente
    const existing = await SharedGiftListInvitation.findOne({
      fromUser: req.payload._id,
      toUser: friendId,
      fromDate: dateId,
      status: "pending",
    });
    if (existing)
      return res.status(200).json({ invitation: existing, already: true });

    const inv = await SharedGiftListInvitation.create({
      fromUser: req.payload._id,
      toUser: friendId,
      fromDate: dateId,
      sharedGiftList: date.sharedGiftList || null,
      label: personLabel(date),
      shareMode,
      giftIds: validGiftIds,
    });

    const me = await User.findById(req.payload._id).select("name surname");
    await notify(req.app, {
      userId: friendId,
      type: "shared_gift_invite",
      data: {
        fromName: `${me?.name || ""} ${me?.surname || ""}`.trim(),
        personName: personLabel(date),
        invitationId: inv._id.toString(),
      },
      link: `/shared-invites`,
    });

    res.status(201).json({ invitation: inv });
  } catch (err) {
    console.error("❌ shared invite:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Mes invitations reçues (pending) ────────────────────────────────────────
router.get("/invitations", isAuthenticated, async (req, res) => {
  try {
    const invs = await SharedGiftListInvitation.find({
      toUser: req.payload._id,
      status: "pending",
    })
      .populate("fromUser", "name surname avatar")
      // `date` et `nameday` en plus du nom : ils permettent au client de
      // proposer la création de la carte préremplie. L'invitation porte déjà
      // tout ce qu'il faut sur la personne concernée — inutile de le redemander.
      .populate("fromDate", "name surname date nameday")
      .sort({ createdAt: -1 });
    res.json(invs);
  } catch (err) {
    console.error("❌ shared invitations:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Mes invitations envoyées (pending), optionnellement pour une carte ──────
router.get("/sent", isAuthenticated, async (req, res) => {
  try {
    const query = { fromUser: req.payload._id, status: "pending" };
    if (req.query.dateId && mongoose.isValidObjectId(req.query.dateId)) {
      query.fromDate = req.query.dateId;
    }
    const invs = await SharedGiftListInvitation.find(query)
      .populate("toUser", "name surname avatar")
      .populate("fromDate", "name surname")
      .sort({ createdAt: -1 });
    res.json(invs);
  } catch (err) {
    console.error("❌ shared sent:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Annuler une invitation que J'AI envoyée ─────────────────────────────────
router.post("/invitations/:id/cancel", isAuthenticated, async (req, res) => {
  try {
    const inv = await SharedGiftListInvitation.findById(req.params.id);
    if (!inv || inv.fromUser.toString() !== req.payload._id)
      return res.status(404).json({ message: "Invitation introuvable" });
    if (inv.status !== "pending")
      return res.status(400).json({ message: "Invitation déjà traitée" });
    await inv.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error("❌ shared cancel:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Accepter une invitation (en choisissant sa carte) ───────────────────────
router.post("/invitations/:id/accept", isAuthenticated, async (req, res) => {
  try {
    const { dateId, newDate } = req.body;
    const inv = await SharedGiftListInvitation.findById(req.params.id);
    if (!inv || inv.toUser.toString() !== req.payload._id)
      return res.status(404).json({ message: "Invitation introuvable" });
    if (inv.status !== "pending")
      return res.status(400).json({ message: "Invitation déjà traitée" });

    const fromDate = await DateModel.findById(inv.fromDate);
    if (!fromDate)
      return res.status(404).json({ message: "Carte initiatrice introuvable" });

    // ── Sur quelle carte poser la liste ? ────────────────────────────────
    // Une liste commune ne s'affiche que posée sur une carte. Jusqu'ici il
    // fallait donc DÉJÀ avoir enregistré la personne concernée pour pouvoir
    // accepter — un blocage courant, puisqu'on est souvent invité à préparer
    // le cadeau de quelqu'un qu'on n'a pas dans son carnet.
    //
    // On accepte maintenant `newDate` : le client peut demander la création de
    // la carte au passage. Les champs absents sont repris de la carte de celui
    // qui invite, qui décrit la même personne — c'est ce qui permet de proposer
    // « Créer la carte de Tom » sans rien faire saisir.
    let myDate = null;

    if (dateId) {
      myDate = await DateModel.findOne({ _id: dateId, owner: req.payload._id });
      if (!myDate)
        return res.status(404).json({ message: "Carte introuvable" });
    } else if (newDate) {
      const birth = newDate.date || fromDate.date;
      if (!birth)
        return res.status(400).json({
          message:
            "Impossible de créer la carte : aucune date de naissance connue.",
        });
      myDate = await DateModel.create({
        owner: req.payload._id,
        name: newDate.name || fromDate.name || "",
        surname: newDate.surname ?? fromDate.surname ?? "",
        date: birth,
        nameday: newDate.nameday ?? fromDate.nameday ?? null,
      });
    } else {
      return res
        .status(400)
        .json({ message: "Précise une carte existante ou une nouvelle" });
    }

    // Récupère ou crée la liste commune
    let list = null;
    const existingListId = inv.sharedGiftList || fromDate.sharedGiftList;
    if (existingListId) list = await SharedGiftList.findById(existingListId);
    if (!list) {
      // Idées à partager depuis la carte initiatrice, selon le mode choisi
      const sourceGifts = fromDate.gifts || [];
      let seed = sourceGifts;
      if (inv.shareMode === "selective" && (inv.giftIds?.length ?? 0) > 0) {
        const idSet = new Set(inv.giftIds.map((id) => id.toString()));
        seed = sourceGifts.filter((g) => idSet.has(g._id.toString()));
      }
      const seededGifts = seed.map((g) => ({
        giftName: g.giftName,
        occasion: g.occasion,
        year: g.year,
        url: g.url ?? null,
        price: g.price ?? null,
        image: g.image ?? null,
        status: g.status ?? "to_buy",
        purchased: g.purchased ?? false,
        addedBy: inv.fromUser,
      }));

      list = await SharedGiftList.create({
        members: [inv.fromUser],
        createdBy: inv.fromUser,
        label: inv.label,
        gifts: seededGifts,
      });
    }

    // Ajoute les deux membres
    const addMember = (uid) => {
      if (!list.members.some((m) => m.toString() === uid.toString()))
        list.members.push(uid);
    };
    addMember(inv.fromUser);
    addMember(req.payload._id);
    await list.save();

    // Relie les deux cartes à la liste
    fromDate.sharedGiftList = list._id;
    await fromDate.save();
    myDate.sharedGiftList = list._id;
    await myDate.save();

    inv.status = "accepted";
    inv.sharedGiftList = list._id;
    await inv.save();

    const me = await User.findById(req.payload._id).select("name surname");
    await notify(req.app, {
      userId: inv.fromUser,
      type: "shared_gift_accepted",
      data: {
        fromName: `${me?.name || ""} ${me?.surname || ""}`.trim(),
        personName: inv.label,
        listId: list._id.toString(),
      },
      link: `/home?tab=date&dateId=${inv.fromDate}`,
    });

    // dateId renvoyé aussi : quand la carte vient d'être créée, le client n'a
    // aucun autre moyen de savoir où naviguer ensuite.
    res.json({ sharedGiftList: list._id, dateId: myDate._id });
  } catch (err) {
    console.error("❌ shared accept:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Refuser une invitation ──────────────────────────────────────────────────
router.post("/invitations/:id/decline", isAuthenticated, async (req, res) => {
  try {
    const inv = await SharedGiftListInvitation.findById(req.params.id);
    if (!inv || inv.toUser.toString() !== req.payload._id)
      return res.status(404).json({ message: "Invitation introuvable" });
    inv.status = "declined";
    await inv.save();
    res.json({ success: true });
  } catch (err) {
    console.error("❌ shared decline:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Middleware : liste + vérif membre ───────────────────────────────────────
async function loadListAsMember(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "ID invalide" });
  const list = await SharedGiftList.findById(req.params.id);
  if (!list) return res.status(404).json({ message: "Liste introuvable" });
  if (!list.members.some((m) => m.toString() === req.payload._id))
    return res.status(403).json({ message: "Non autorisé" });
  req.sharedList = list;
  req.listRole = "member";
  next();
}

/**
 * Membre OU invité. À utiliser pour tout ce qui relève de la consultation et
 * de la réservation ; `loadListAsMember` reste requis pour modifier le contenu
 * de la liste ou gérer les accès.
 *
 * Pose `req.listRole` : les routes s'en servent pour masquer aux invités les
 * prénoms des réserveurs. Un invité voit qu'un cadeau est pris, jamais par qui.
 */
async function loadListAsParticipant(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "ID invalide" });
  const list = await SharedGiftList.findById(req.params.id);
  if (!list) return res.status(404).json({ message: "Liste introuvable" });

  const uid = req.payload._id;
  const isMember = list.members.some((m) => m.toString() === uid);
  const isViewer = (list.viewers || []).some(
    (v) => v.user && v.user.toString() === uid,
  );
  if (!isMember && !isViewer)
    return res.status(403).json({ message: "Non autorisé" });

  req.sharedList = list;
  req.listRole = isMember ? "member" : "viewer";
  next();
}

/**
 * Vue d'une liste adaptée au rôle. Un invité reçoit `reservedBy` réduit à un
 * booléen : c'est ici, au seul endroit qui sérialise la liste, qu'on garantit
 * qu'aucun prénom de réserveur ne fuite vers un non-membre.
 */
/**
 * Statuts qu'un INVITÉ (viewer) ne doit pas voir du tout.
 *
 * Une liste commune sert à empêcher qu'on offre deux fois la même chose. Un
 * cadeau déjà offert n'a plus d'intérêt, et un cadeau déjà acheté n'est plus à
 * prendre : les afficher à un invité l'invite au doublon exact que la liste
 * évite. Il ne voit donc que ce qui reste à faire.
 *
 * ⚠️ "to_give" est inclus, alors que la demande ne citait que "offert" et
 * "acheté" : ce statut signifie « acheté, en attente d'être remis », donc le
 * cadeau est tout aussi verrouillé. Le laisser visible rouvrirait la porte au
 * double achat. Une ligne à retirer ici si tu préfères l'inverse.
 */
const HIDDEN_STATUSES_FOR_VIEWER = new Set(["bought", "to_give", "offered"]);

function serializeListForRole(list, role, userId) {
  const obj = list.toObject ? list.toObject() : list;
  if (role === "member") return obj;

  return {
    ...obj,
    // Les invités n'ont pas à connaître la composition de la liste.
    viewers: undefined,
    accessCode: undefined,
    members: undefined,
    gifts: (obj.gifts || [])
      .filter((g) => !HIDDEN_STATUSES_FOR_VIEWER.has(g.status))
      .map((g) => {
        // reservedBy peut être peuplé (objet) ou brut (ObjectId) selon l'appel.
        const rid = g.reservedBy?._id ?? g.reservedBy;
        return {
          ...g,
          addedBy: undefined,
          reservedBy: undefined,
          reservedByGuest: undefined,
          isReserved: !!g.reservedBy || !!g.reservedByGuest,
          // Le seul lien conservé : est-ce MOI qui ai réservé ? Sans lui,
          // l'invité ne pourrait pas annuler sa propre réservation.
          reservedByMe: !!rid && String(rid) === String(userId),
        };
      }),
  };
}

// ── Listes partagées avec moi, pas encore rattachées ────────────────────────
// Une liste ne s'affiche dans l'app que rattachée à une carte. Sans cette
// route, un invité qui supprime sa notification n'aurait plus aucun moyen
// d'atteindre la liste : elle existerait pour lui sans être joignable.
//
// ⚠️ Déclarée AVANT `/:id` — sinon "shared-with-me" serait pris pour un id.
/**
 * Identité de la personne dont la liste parle, déduite d'une carte déjà
 * rattachée à cette liste.
 *
 * Une liste commune est posée, chez chaque membre, sur la carte de la personne
 * concernée : n'importe laquelle de ces cartes décrit donc cette personne. On
 * s'en sert pour proposer la création de la carte préremplie à quelqu'un qui
 * reçoit la liste et n'a pas encore enregistré cette personne — sans quoi il
 * doit ressaisir un nom et une date de naissance qu'il ne connaît peut-être
 * même pas.
 *
 * Aucune fuite : on ne le renvoie qu'à des participants de la liste, et savoir
 * POUR QUI on cherche des idées est précisément l'objet du partage. Le libellé
 * de la liste porte d'ailleurs souvent déjà ce prénom.
 */
async function suggestedCardFor(listId) {
  const ref = await DateModel.findOne({ sharedGiftList: listId }).select(
    "name surname date nameday",
  );
  if (!ref) return null;
  return {
    name: ref.name || "",
    surname: ref.surname || "",
    date: ref.date || null,
    nameday: ref.nameday || null,
  };
}

router.get("/shared-with-me", isAuthenticated, async (req, res) => {
  try {
    const uid = req.payload._id;

    const lists = await SharedGiftList.find({ "viewers.user": uid })
      .select("label gifts createdBy")
      .populate("createdBy", "name surname");

    // Celles déjà posées sur une de mes cartes n'ont plus à être proposées.
    const attached = await DateModel.find({
      owner: uid,
      sharedGiftList: { $ne: null },
    }).select("sharedGiftList");
    const attachedIds = new Set(
      attached.map((d) => d.sharedGiftList.toString()),
    );

    const pending = lists.filter((l) => !attachedIds.has(l._id.toString()));

    res.json(
      await Promise.all(
        pending.map(async (l) => ({
          _id: l._id,
          label: l.label || null,
          giftCount: (l.gifts || []).length,
          from: l.createdBy
            ? { name: l.createdBy.name, surname: l.createdBy.surname }
            : null,
          // Permet de proposer « Créer la carte de X » sans rien faire saisir.
          suggestedCard: await suggestedCardFor(l._id),
        })),
      ),
    );
  } catch (err) {
    console.error("❌ shared-with-me:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Détail liste (gifts + membres) ──────────────────────────────────────────
router.get("/:id", isAuthenticated, loadListAsParticipant, async (req, res) => {
  try {
    const list = await SharedGiftList.findById(req.params.id)
      .populate("members", "name surname avatar")
      .populate("gifts.addedBy", "name surname")
      .populate("gifts.reservedBy", "name surname");
    // `myRole` permet à l'app de masquer d'emblée ce qu'un invité ne peut pas
    // faire, plutôt que de lui laisser découvrir ses limites par des 403.
    res.json({
      ...serializeListForRole(list, req.listRole, req.payload._id),
      myRole: req.listRole,
      // L'écran de rattachement ne connaît que l'id de la liste : c'est ici
      // qu'il récupère de quoi proposer la carte préremplie.
      suggestedCard: await suggestedCardFor(list._id),
    });
  } catch (err) {
    console.error("❌ shared get:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Ajouter un cadeau commun ────────────────────────────────────────────────
router.post("/:id/gifts", isAuthenticated, loadListAsMember, async (req, res) => {
  try {
    const { giftName, occasion, year, url, price, image, status } = req.body;
    if (!giftName || !giftName.trim())
      return res.status(400).json({ message: "Nom requis" });
    req.sharedList.gifts.push({
      giftName: giftName.trim(),
      occasion: occasion || "Anniversaire",
      year: year || new Date().getFullYear(),
      status: status || "to_buy",
      purchased: status ? status !== "to_buy" : false,
      url: url || null,
      price: price ?? null,
      image: image || null,
      addedBy: req.payload._id,
    });
    await req.sharedList.save();
    // Même forme que GET /:id : le front réinjecte cette réponse
    // directement dans son état, une divergence de forme y produirait des
    // champs manquants jusqu'au rechargement suivant.
    res.status(201).json({
      ...serializeListForRole(req.sharedList, req.listRole, req.payload._id),
      myRole: req.listRole,
    });

    // Après la réponse : l'ajout est acquis, la notification ne doit ni le
    // retarder ni le faire échouer.
    const who = await actorName(req.payload._id);
    const label = req.sharedList.label || null;
    await notifyOtherMembers(req.app, req.sharedList, req.payload._id, {
      type: "shared_gift_added",
      data: { fromName: who, giftName: giftName.trim(), listLabel: label },
      pushTitle: "🎁 Nouvelle idée dans votre liste commune",
      pushBody: `${who} a ajouté « ${giftName.trim()} »`,
      // Une idée qui arrive peut intéresser un invité : c'est peut-être lui qui
      // s'en chargera. C'est l'un des deux seuls cas où on le dérange.
      alsoViewers: viewerIds(req.sharedList),
    });
  } catch (err) {
    console.error("❌ shared add gift:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── Modifier un cadeau commun ───────────────────────────────────────────────
router.patch(
  "/:id/gifts/:giftId",
  isAuthenticated,
  loadListAsMember,
  async (req, res) => {
    try {
      const gift = req.sharedList.gifts.id(req.params.giftId);
      if (!gift) return res.status(404).json({ message: "Cadeau introuvable" });
      const { giftName, occasion, year, url, price, image, status } = req.body;
      if (giftName !== undefined) gift.giftName = giftName;
      if (occasion !== undefined) gift.occasion = occasion;
      if (year !== undefined) gift.year = year;
      if (url !== undefined) gift.url = url || null;
      if (price !== undefined) gift.price = price ? Number(price) : null;
      if (image !== undefined) gift.image = image || null;
      if (status !== undefined) {
        gift.status = status;
        gift.purchased = status !== "to_buy";
      }
      await req.sharedList.save();
      res.json({
        ...serializeListForRole(req.sharedList, req.listRole, req.payload._id),
        myRole: req.listRole,
      });

      const who = await actorName(req.payload._id);
      // Le passage en acheté/offert est l'information la plus utile de toutes
      // — c'est elle qui évite le doublon — donc on la sort dans le texte.
      const statusLabel = {
        bought: "l'a marquée comme achetée",
        to_give: "l'a marquée comme à offrir",
        offered: "l'a marquée comme offerte",
        to_buy: "l'a remise dans les idées à acheter",
      }[status];
      await notifyOtherMembers(req.app, req.sharedList, req.payload._id, {
        type: "shared_gift_updated",
        data: {
          fromName: who,
          giftName: gift.giftName,
          statusLabel: statusLabel || null,
          listLabel: req.sharedList.label || null,
        },
        pushTitle: "🎁 Liste commune mise à jour",
        pushBody: statusLabel
          ? `${who} ${statusLabel} : « ${gift.giftName} »`
          : `${who} a modifié « ${gift.giftName} »`,
      });
    } catch (err) {
      console.error("❌ shared update gift:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

// ── Supprimer un cadeau commun ──────────────────────────────────────────────
router.delete(
  "/:id/gifts/:giftId",
  isAuthenticated,
  loadListAsMember,
  async (req, res) => {
    try {
      const gift = req.sharedList.gifts.id(req.params.giftId);
      if (!gift) return res.status(404).json({ message: "Cadeau introuvable" });
      // Mongoose 6 : les sous-documents n'ont pas .deleteOne() (ajouté en v7).
      // .pull() retire l'élément du tableau, toutes versions confondues.
      // Nom retenu AVANT le pull : après, le sous-document n'existe plus.
      const removedName = gift.giftName;
      // Qui l'avait réservé, AVANT le pull — après, le sous-document n'existe
      // plus. Cette personne comptait s'en charger : si c'est un invité, il
      // fait partie des rares cas où on le notifie, parce qu'il aurait sinon
      // découvert la disparition en arrivant les mains vides.
      const reserverId = gift.reservedBy ? gift.reservedBy.toString() : null;
      req.sharedList.gifts.pull(req.params.giftId);
      await req.sharedList.save();
      res.json({
        ...serializeListForRole(req.sharedList, req.listRole, req.payload._id),
        myRole: req.listRole,
      });

      const who = await actorName(req.payload._id);
      const concernedViewers = viewerIds(req.sharedList).filter(
        (v) => reserverId && v.toString() === reserverId,
      );
      await notifyOtherMembers(req.app, req.sharedList, req.payload._id, {
        alsoViewers: concernedViewers,
        type: "shared_gift_removed",
        data: {
          fromName: who,
          giftName: removedName,
          listLabel: req.sharedList.label || null,
        },
        pushTitle: "🎁 Idée retirée de votre liste commune",
        pushBody: `${who} a retiré « ${removedName} »`,
      });
    } catch (err) {
      console.error("❌ shared delete gift:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

// ── Réserver / libérer un cadeau commun ─────────────────────────────────────
// « Je m'en occupe » : empêche deux membres d'acheter la même chose.
// Seul le réserveur peut libérer sa réservation — sinon n'importe qui pourrait
// s'approprier le cadeau d'un autre, ce qui viderait le mécanisme de son sens.
// Le cadeau n'est jamais retiré de la liste, seulement marqué.
router.post(
  "/:id/gifts/:giftId/reserve",
  isAuthenticated,
  // Participant et non membre : réserver est justement ce qu'un invité vient
  // faire. Seul le contenu de la liste lui reste interdit.
  loadListAsParticipant,
  async (req, res) => {
    try {
      const gift = req.sharedList.gifts.id(req.params.giftId);
      if (!gift) return res.status(404).json({ message: "Cadeau introuvable" });
      if (gift.reservedBy)
        return res
          .status(409)
          .json({ message: "Ce cadeau est déjà réservé par un membre" });

      gift.reservedBy = req.payload._id;
      gift.reservedAt = new Date();
      await req.sharedList.save();
      res.json(
        serializeListForRole(req.sharedList, req.listRole, req.payload._id),
      );

      const who = await actorName(req.payload._id);
      await notifyOtherMembers(req.app, req.sharedList, req.payload._id, {
        type: "shared_gift_updated",
        data: {
          fromName: who,
          giftName: gift.giftName,
          statusLabel: "s'occupe de",
          listLabel: req.sharedList.label || null,
        },
        pushTitle: "🎁 Cadeau réservé",
        pushBody: `${who} s'occupe de « ${gift.giftName} »`,
      });
    } catch (err) {
      console.error("❌ shared reserve:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

router.post(
  "/:id/gifts/:giftId/unreserve",
  isAuthenticated,
  // Participant et non membre : réserver est justement ce qu'un invité vient
  // faire. Seul le contenu de la liste lui reste interdit.
  loadListAsParticipant,
  async (req, res) => {
    try {
      const gift = req.sharedList.gifts.id(req.params.giftId);
      if (!gift) return res.status(404).json({ message: "Cadeau introuvable" });
      if (!gift.reservedBy)
        return res.status(400).json({ message: "Ce cadeau n'est pas réservé" });
      if (gift.reservedBy.toString() !== req.payload._id)
        return res
          .status(403)
          .json({ message: "Seul le membre qui a réservé peut annuler" });

      gift.reservedBy = null;
      gift.reservedAt = null;
      await req.sharedList.save();
      res.json(
        serializeListForRole(req.sharedList, req.listRole, req.payload._id),
      );

      const who = await actorName(req.payload._id);
      await notifyOtherMembers(req.app, req.sharedList, req.payload._id, {
        type: "shared_gift_updated",
        data: {
          fromName: who,
          giftName: gift.giftName,
          statusLabel: "ne s'occupe plus de",
          listLabel: req.sharedList.label || null,
        },
        pushTitle: "🎁 Réservation annulée",
        pushBody: `${who} ne s'occupe plus de « ${gift.giftName} »`,
      });
    } catch (err) {
      console.error("❌ shared unreserve:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

// ── Accès à la liste : qui la voit, code de réservation ─────────────────────
// Réservé aux membres — créateur et contributeurs. Un invité ne gère pas les
// accès et ne connaît même pas la composition de la liste.

/** Code court, lisible à l'oral, sans caractères ambigus (0/O, 1/I). */
const generateAccessCode = () => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

router.get("/:id/access", isAuthenticated, loadListAsMember, async (req, res) => {
  try {
    const list = await SharedGiftList.findById(req.params.id)
      .populate("members", "name surname avatar")
      .populate("viewers.user", "name surname avatar")
      .populate("viewers.addedBy", "name surname");

    res.json({
      members: list.members,
      viewers: (list.viewers || []).filter((v) => v.user),
      accessCode: list.accessCode || null,
      createdBy: list.createdBy,
    });
  } catch (err) {
    console.error("❌ shared access:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/** (Re)génère le code demandé aux visiteurs web au moment de réserver. */
router.post(
  "/:id/access/code",
  isAuthenticated,
  loadListAsMember,
  async (req, res) => {
    try {
      req.sharedList.accessCode = generateAccessCode();
      await req.sharedList.save();
      res.json({ accessCode: req.sharedList.accessCode });
    } catch (err) {
      console.error("❌ shared access code:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

// ── Partage interne : donner accès à un contact ─────────────────────────────
// L'invité peut consulter et réserver, jamais modifier la liste.
router.post("/:id/viewers", isAuthenticated, loadListAsMember, async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!mongoose.isValidObjectId(friendId))
      return res.status(400).json({ message: "Contact invalide" });

    const list = req.sharedList;

    if (list.members.some((m) => m.toString() === friendId))
      return res
        .status(400)
        .json({ message: "Cette personne est déjà membre de la liste" });

    if ((list.viewers || []).some((v) => v.user?.toString() === friendId))
      return res
        .status(400)
        .json({ message: "Cette personne a déjà accès à la liste" });

    // Blocage : refus silencieux, cohérent avec le reste de l'app.
    if (await isBlockedBetween(req.payload._id, friendId))
      return res.status(201).json({ ok: true });

    list.viewers.push({
      user: friendId,
      addedBy: req.payload._id,
      addedAt: new Date(),
    });
    await list.save();

    const who = await actorName(req.payload._id);
    await notify(req.app, {
      userId: friendId,
      type: "shared_gift_shared",
      data: {
        fromName: who,
        listId: list._id.toString(),
        listLabel: list.label || null,
      },
      // Un "viewer" n'a pas encore de carte portant la liste : on l'envoie
      // sur l'écran de rattachement, pas sur sa liste d'amis.
      link: `/shared-list/${list._id}/attach`,
    });
    await sendPushToUser(friendId, {
      title: "🎁 Une liste de cadeaux t'a été partagée",
      body: `${who} t'a donné accès à sa liste d'idées`,
      url: `/shared-list/${list._id}/attach`,
      tag: `shared-list-shared-${list._id}`,
      type: "shared_list",
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("❌ shared add viewer:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/** Retirer l'accès à un invité. Membres uniquement. */
router.delete(
  "/:id/viewers/:userId",
  isAuthenticated,
  loadListAsMember,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const list = req.sharedList;
      const before = (list.viewers || []).length;
      list.viewers = (list.viewers || []).filter(
        (v) => v.user?.toString() !== userId,
      );
      if (list.viewers.length === before)
        return res.status(404).json({ message: "Cet invité n'a pas d'accès" });

      await list.save();

      // Détache la liste de la carte de l'invité : sans ça il garderait un
      // encart « Liste commune » qui renverrait désormais un 403.
      await DateModel.updateMany(
        { owner: userId, sharedGiftList: list._id },
        { sharedGiftList: null },
      );

      res.json({ ok: true });
    } catch (err) {
      console.error("❌ shared remove viewer:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

// ── Rattacher la liste à une de MES cartes ──────────────────────────────────
// Une liste ne s'affiche dans l'app que rattachée à une carte (Date). Cette
// route sert au destinataire d'un partage : il choisit la carte existante de
// la personne concernée, ou en crée une au passage.
//
// ⚠️ Règle « une seule liste par carte » : une carte ne peut porter qu'une
// liste commune. Si elle en a déjà une autre, on refuse en le disant, et le
// client peut renvoyer `replace: true` pour remplacer volontairement.
router.post(
  "/:id/attach",
  isAuthenticated,
  loadListAsParticipant,
  async (req, res) => {
    try {
      const { dateId, newDate, replace } = req.body;
      const uid = req.payload._id;
      const list = req.sharedList;
      let target = null;

      if (dateId) {
        if (!mongoose.isValidObjectId(dateId))
          return res.status(400).json({ message: "Carte invalide" });
        target = await DateModel.findOne({ _id: dateId, owner: uid });
        if (!target)
          return res.status(404).json({ message: "Carte introuvable" });
      } else if (newDate) {
        // Les champs absents sont repris de la carte d'un membre, qui décrit
        // la même personne : `{ newDate: {} }` suffit donc pour créer la carte,
        // et le client peut proposer « Créer la carte de X » en un geste.
        const ref = await suggestedCardFor(list._id);
        const birth = newDate.date || ref?.date;
        const name = newDate.name || ref?.name;
        if (!name || !birth)
          return res.status(400).json({
            message:
              "Impossible de créer la carte : prénom ou date de naissance manquants.",
          });
        target = await DateModel.create({
          owner: uid,
          name,
          surname: newDate.surname ?? ref?.surname ?? "",
          date: birth,
          nameday: newDate.nameday ?? ref?.nameday ?? null,
        });
      } else {
        return res
          .status(400)
          .json({ message: "Précise une carte existante ou une nouvelle" });
      }

      const current = target.sharedGiftList?.toString();
      if (current && current !== list._id.toString() && !replace) {
        return res.status(409).json({
          code: "ALREADY_HAS_LIST",
          message:
            "Cette personne a déjà une liste commune. Tu ne peux en avoir qu'une par carte.",
        });
      }

      target.sharedGiftList = list._id;
      await target.save();

      res.json({ ok: true, dateId: target._id });
    } catch (err) {
      console.error("❌ shared attach:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

// ── Partage public de la liste ──────────────────────────────────────────────
// Calqué sur la wishlist publique d'un utilisateur : un lien opaque, sans
// compte requis pour le consulter. Réservé aux membres de la liste.
const publicUrlFor = (slug) =>
  `${process.env.FRONTEND_URL || "https://birthreminder.com"}/liste/${slug}`;

router.get("/:id/share", isAuthenticated, loadListAsMember, async (req, res) => {
  try {
    const list = req.sharedList;
    res.json({
      isPublic: !!list.isPublic,
      publicSlug: list.publicSlug || null,
      publicUrl: list.publicSlug ? publicUrlFor(list.publicSlug) : null,
    });
  } catch (err) {
    console.error("❌ shared share get:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.patch(
  "/:id/share/toggle",
  isAuthenticated,
  loadListAsMember,
  async (req, res) => {
    try {
      const list = req.sharedList;

      // Slug généré à la première activation puis conservé : un lien déjà
      // distribué redevient valide si on réactive le partage plus tard.
      if (!list.publicSlug) {
        let slug;
        let exists = true;
        while (exists) {
          slug = nanoid(10);
          exists = await SharedGiftList.findOne({ publicSlug: slug });
        }
        list.publicSlug = slug;
      }

      list.isPublic = !list.isPublic;
      await list.save();

      res.json({
        isPublic: list.isPublic,
        publicSlug: list.publicSlug,
        publicUrl: publicUrlFor(list.publicSlug),
      });
    } catch (err) {
      console.error("❌ shared share toggle:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

// ── Quitter la liste commune ────────────────────────────────────────────────
/**
 * Quitter une liste commune.
 *
 * ⚠️ Ouvert aux MEMBRES ET AUX INVITÉS. La route était gardée par
 * `loadListAsMember` : un invité recevait 403, son entrée restait dans
 * `viewers`, et sa carte restait rattachée — il « quittait » la liste et la
 * revoyait au rechargement suivant. Il n'existait aucune autre route pour
 * retirer sa propre entrée d'invité (seul un membre pouvait le faire via
 * DELETE /:id/viewers/:userId), donc aucun moyen de partir de son plein gré.
 */
router.post(
  "/:id/leave",
  isAuthenticated,
  loadListAsParticipant,
  async (req, res) => {
    try {
      const list = req.sharedList;

      // ── Invité : on retire son accès, la liste elle-même ne bouge pas ────
      if (req.listRole !== "member") {
        list.viewers = (list.viewers || []).filter(
          (v) => !v.user || v.user.toString() !== req.payload._id,
        );
        await list.save();
        // Sa carte cesse de porter la liste, sinon elle continuerait de
        // l'afficher alors qu'il n'y a plus accès (403 au prochain fetch).
        await DateModel.updateMany(
          { owner: req.payload._id, sharedGiftList: list._id },
          { sharedGiftList: null },
        );
        return res.json({ success: true, role: "viewer" });
      }

      return leaveAsMember(req, res);
    } catch (err) {
      console.error("❌ shared leave:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

async function leaveAsMember(req, res) {
  try {
    const list = req.sharedList;
    list.members = list.members.filter(
      (m) => m.toString() !== req.payload._id,
    );
    // Détache ma carte
    await DateModel.updateMany(
      { owner: req.payload._id, sharedGiftList: list._id },
      { sharedGiftList: null },
    );
    const listLabel = list.label || null;
    const remaining = [...list.members];

    if (list.members.length === 0) {
      await DateModel.updateMany(
        { sharedGiftList: list._id },
        { sharedGiftList: null },
      );
      await list.deleteOne();
    } else {
      await list.save();
    }
    res.json({ success: true });

    // `remaining` ne contient déjà plus le partant (filtré ci-dessus), donc
    // seuls ceux qui restent sont prévenus. Si la liste est vide, la boucle ne
    // tourne pas — et la liste vient d'être supprimée de toute façon.
    if (remaining.length) {
      const who = await actorName(req.payload._id);
      await notifyOtherMembers(
        req.app,
        { _id: list._id, members: remaining },
        req.payload._id,
        {
          type: "shared_gift_member_left",
          data: { fromName: who, listLabel },
          pushTitle: "👥 Départ d'une liste commune",
          pushBody: `${who} a quitté votre liste d'idées cadeaux`,
        },
      );
    }
  } catch (err) {
    console.error("❌ shared leave (membre):", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
}

module.exports = router;
