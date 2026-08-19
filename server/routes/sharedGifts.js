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
  { type, data, pushTitle, pushBody },
) {
  try {
    const others = (list.members || []).filter(
      (m) => m && m.toString() !== actorId.toString(),
    );
    if (!others.length) return;

    for (const memberId of others) {
      await notify(app, {
        userId: memberId,
        type,
        data,
        link: "/home?tab=friends",
      });
      await sendPushToUser(memberId, {
        title: pushTitle,
        body: pushBody,
        url: "/home?tab=friends",
        tag: `shared-list-${list._id}`,
        type: "shared_list",
      });
    }
  } catch (err) {
    console.error("❌ Notification liste commune échouée:", err.message);
  }
}

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
      .populate("fromDate", "name surname")
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
    const { dateId } = req.body;
    const inv = await SharedGiftListInvitation.findById(req.params.id);
    if (!inv || inv.toUser.toString() !== req.payload._id)
      return res.status(404).json({ message: "Invitation introuvable" });
    if (inv.status !== "pending")
      return res.status(400).json({ message: "Invitation déjà traitée" });

    const myDate = await DateModel.findOne({
      _id: dateId,
      owner: req.payload._id,
    });
    if (!myDate) return res.status(404).json({ message: "Carte introuvable" });

    const fromDate = await DateModel.findById(inv.fromDate);
    if (!fromDate)
      return res.status(404).json({ message: "Carte initiatrice introuvable" });

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

    res.json({ sharedGiftList: list._id });
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
function serializeListForRole(list, role, userId) {
  const obj = list.toObject ? list.toObject() : list;
  if (role === "member") return obj;

  return {
    ...obj,
    // Les invités n'ont pas à connaître la composition de la liste.
    viewers: undefined,
    accessCode: undefined,
    members: undefined,
    gifts: (obj.gifts || []).map((g) => {
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

    res.json(
      lists
        .filter((l) => !attachedIds.has(l._id.toString()))
        .map((l) => ({
          _id: l._id,
          label: l.label || null,
          giftCount: (l.gifts || []).length,
          from: l.createdBy
            ? { name: l.createdBy.name, surname: l.createdBy.surname }
            : null,
        })),
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
    res.status(201).json(req.sharedList);

    // Après la réponse : l'ajout est acquis, la notification ne doit ni le
    // retarder ni le faire échouer.
    const who = await actorName(req.payload._id);
    const label = req.sharedList.label || null;
    await notifyOtherMembers(req.app, req.sharedList, req.payload._id, {
      type: "shared_gift_added",
      data: { fromName: who, giftName: giftName.trim(), listLabel: label },
      pushTitle: "🎁 Nouvelle idée dans votre liste commune",
      pushBody: `${who} a ajouté « ${giftName.trim()} »`,
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
      res.json(req.sharedList);

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
      req.sharedList.gifts.pull(req.params.giftId);
      await req.sharedList.save();
      res.json(req.sharedList);

      const who = await actorName(req.payload._id);
      await notifyOtherMembers(req.app, req.sharedList, req.payload._id, {
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
      link: "/home?tab=friends",
    });
    await sendPushToUser(friendId, {
      title: "🎁 Une liste de cadeaux t'a été partagée",
      body: `${who} t'a donné accès à sa liste d'idées`,
      url: "/home?tab=friends",
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
      } else if (newDate?.name && newDate?.date) {
        target = await DateModel.create({
          owner: uid,
          name: newDate.name,
          surname: newDate.surname || "",
          date: newDate.date,
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
router.post("/:id/leave", isAuthenticated, loadListAsMember, async (req, res) => {
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
    console.error("❌ shared leave:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
