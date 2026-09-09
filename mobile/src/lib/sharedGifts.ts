import { api } from "./api";
import { Gift } from "./dates";

/** Rôle de l'utilisateur courant sur une liste. Un « viewer » consulte et
 *  réserve, sans jamais toucher au contenu ni voir qui a réservé. */
export type SharedListRole = "member" | "viewer";

export interface SharedGift extends Gift {
  addedBy?: { _id: string; name: string; surname?: string } | null;
  /**
   * Idée gardée entre gestionnaires : ni les invités ni le lien public ne la
   * reçoivent. Le filtrage est fait par le serveur, donc ce champ n'arrive
   * qu'aux membres — un invité ne verra jamais ces idées, même à false.
   */
  hiddenFromViewers?: boolean;
  /** Membre qui s'est réservé ce cadeau, ou null s'il est libre. */
  reservedBy?: { _id: string; name: string; surname?: string } | null;
  /**
   * Prénom d'un visiteur venu du lien public, qui n'a pas de compte. Renvoyé
   * aux seuls membres — un invité ne voit jamais qui réserve.
   */
  reservedByGuest?: string | null;
  reservedAt?: string | null;
  /**
   * Réservé, par qui que ce soit — membre OU visiteur du lien public.
   * Calculé par le serveur pour les deux rôles : les membres ne le recevaient
   * pas et testaient `reservedBy` seul, donc une réservation venue du lien
   * public n'apparaissait pas chez eux.
   */
  isReserved?: boolean;
  reservedByMe?: boolean;
}

export interface SharedMember {
  _id: string;
  name: string;
  surname?: string;
  avatar?: string | null;
}

export interface SharedGiftList {
  _id: string;
  label?: string | null;
  /** Absent dans la vue « invité » : il ne connaît pas la composition. */
  members?: SharedMember[];
  gifts: SharedGift[];
  createdBy?: string;
  /** Renvoyé par GET /shared-gifts/:id — pilote ce que l'écran autorise. */
  myRole?: SharedListRole;
  /**
   * Identité de la personne dont la liste parle, déduite par le serveur d'une
   * carte déjà rattachée chez un membre. Permet de proposer la création de la
   * carte préremplie à qui reçoit la liste sans connaître cette personne.
   */
  suggestedCard?: SuggestedCard | null;
}

export interface SuggestedCard {
  name: string;
  surname: string;
  date: string | null;
  nameday: string | null;
}

export interface SharedInvitation {
  _id: string;
  fromUser: { _id: string; name: string; surname?: string; avatar?: string };
  // `date` et `nameday` viennent du populate élargi côté serveur : ils
  // permettent de proposer la création de la carte préremplie.
  fromDate: {
    _id: string;
    name: string;
    surname?: string;
    date?: string;
    nameday?: string | null;
  };
  label?: string | null;
  status: string;
  createdAt: string;
}

export async function inviteSharedList(
  friendId: string,
  dateId: string,
  options?: { mode?: "full" | "selective"; giftIds?: string[] },
): Promise<void> {
  await api("/shared-gifts/invite", {
    method: "POST",
    body: JSON.stringify({
      friendId,
      dateId,
      mode: options?.mode ?? "full",
      giftIds: options?.giftIds ?? [],
    }),
  });
}

export async function fetchSharedInvitations(): Promise<SharedInvitation[]> {
  return api<SharedInvitation[]>("/shared-gifts/invitations");
}

export interface SentInvitation {
  _id: string;
  toUser: { _id: string; name: string; surname?: string };
  // `date` et `nameday` viennent du populate élargi côté serveur : ils
  // permettent de proposer la création de la carte préremplie.
  fromDate: {
    _id: string;
    name: string;
    surname?: string;
    date?: string;
    nameday?: string | null;
  };
  status: string;
}

export async function fetchSentSharedInvitations(
  dateId?: string,
): Promise<SentInvitation[]> {
  const q = dateId ? `?dateId=${dateId}` : "";
  return api<SentInvitation[]>(`/shared-gifts/sent${q}`);
}

export async function cancelSharedInvitation(id: string): Promise<void> {
  await api(`/shared-gifts/invitations/${id}/cancel`, { method: "POST" });
}

/**
 * Accepter une invitation à une liste commune.
 *
 * `{ dateId }` pose la liste sur une carte existante. `{ newDate: {} }` demande
 * au serveur de créer la carte au passage : il reprend le nom et la date de
 * naissance depuis la carte de celui qui invite, qui décrit la même personne —
 * on peut donc accepter sans avoir enregistré cette personne au préalable, ce
 * qui était jusqu'ici un blocage complet.
 */
export async function acceptSharedInvitation(
  id: string,
  target: { dateId: string } | { newDate: Record<string, unknown> },
): Promise<{ sharedGiftList: string; dateId: string }> {
  return api(`/shared-gifts/invitations/${id}/accept`, {
    method: "POST",
    body: JSON.stringify(target),
  });
}

export async function declineSharedInvitation(id: string): Promise<void> {
  await api(`/shared-gifts/invitations/${id}/decline`, { method: "POST" });
}

export async function fetchSharedList(id: string): Promise<SharedGiftList> {
  return api<SharedGiftList>(`/shared-gifts/${id}`);
}

export async function addSharedGift(
  listId: string,
  gift: {
    giftName: string;
    occasion?: string;
    year?: number;
    url?: string;
    price?: number;
    image?: string;
    status?: string;
  },
): Promise<SharedGiftList> {
  return api(`/shared-gifts/${listId}/gifts`, {
    method: "POST",
    body: JSON.stringify(gift),
  });
}

export async function updateSharedGift(
  listId: string,
  giftId: string,
  fields: Partial<SharedGift>,
): Promise<SharedGiftList> {
  return api(`/shared-gifts/${listId}/gifts/${giftId}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

export async function deleteSharedGift(
  listId: string,
  giftId: string,
): Promise<SharedGiftList> {
  return api(`/shared-gifts/${listId}/gifts/${giftId}`, { method: "DELETE" });
}

export async function leaveSharedList(listId: string): Promise<void> {
  await api(`/shared-gifts/${listId}/leave`, { method: "POST" });
}

/**
 * « Je m'en occupe ». Le cadeau reste dans la liste, marqué au nom du
 * réserveur : les membres sont les offrants, la personne concernée n'a pas
 * accès à la liste, il n'y a donc pas de surprise à protéger entre eux.
 */
export async function reserveSharedGift(
  listId: string,
  giftId: string,
): Promise<SharedGiftList> {
  return api(`/shared-gifts/${listId}/gifts/${giftId}/reserve`, {
    method: "POST",
  });
}

/** Libère sa propre réservation (cadeau finalement pas offert). */
export async function unreserveSharedGift(
  listId: string,
  giftId: string,
): Promise<SharedGiftList> {
  return api(`/shared-gifts/${listId}/gifts/${giftId}/unreserve`, {
    method: "POST",
  });
}

export interface SharedListShareSettings {
  isPublic: boolean;
  publicSlug: string | null;
  publicUrl: string | null;
  /** Code qui ouvre la liste depuis le lien public, s'il en existe un. */
  accessCode: string | null;
  /**
   * Le même lien, code inclus. Depuis que le code garde la porte, envoyer le
   * lien nu oblige à envoyer le code dans un second message — et la moitié
   * des gens ne le font pas. Ce lien-ci suffit à lui seul.
   */
  publicUrlWithCode: string | null;
}

/** État du partage public de la liste (lien consultable sans compte). */
export async function fetchSharedListShare(
  listId: string,
): Promise<SharedListShareSettings> {
  return api(`/shared-gifts/${listId}/share`);
}

/**
 * Active ou coupe le partage public. Le lien est généré à la première
 * activation puis conservé : le couper puis le réactiver redonne la même URL,
 * donc un lien déjà transmis refonctionne.
 */
export async function toggleSharedListShare(
  listId: string,
): Promise<SharedListShareSettings> {
  return api(`/shared-gifts/${listId}/share/toggle`, { method: "PATCH" });
}

export interface SharedListAccess {
  members: { _id: string; name: string; surname?: string; avatar?: string }[];
  viewers: {
    user: { _id: string; name: string; surname?: string; avatar?: string };
    addedBy?: { _id: string; name: string } | null;
    addedAt?: string;
  }[];
  accessCode: string | null;
  createdBy?: string | null;
}

/** Qui a accès à la liste : membres, invités, et le code de réservation web. */
export async function fetchSharedListAccess(
  listId: string,
): Promise<SharedListAccess> {
  return api(`/shared-gifts/${listId}/access`);
}

/** (Re)génère le code demandé aux visiteurs web pour réserver. */
export async function regenerateAccessCode(
  listId: string,
): Promise<{ accessCode: string }> {
  return api(`/shared-gifts/${listId}/access/code`, { method: "POST" });
}

/** Donne accès à un contact, en lecture + réservation seulement. */
export async function addSharedListViewer(
  listId: string,
  friendId: string,
): Promise<void> {
  await api(`/shared-gifts/${listId}/viewers`, {
    method: "POST",
    body: JSON.stringify({ friendId }),
  });
}

/** Retire l'accès d'un invité (et détache la liste de sa carte). */
export async function removeSharedListViewer(
  listId: string,
  userId: string,
): Promise<void> {
  await api(`/shared-gifts/${listId}/viewers/${userId}`, { method: "DELETE" });
}

/**
 * Rattache la liste à une de mes cartes pour qu'elle s'y affiche.
 * Renvoie un conflit `ALREADY_HAS_LIST` si la carte en porte déjà une autre :
 * une carte ne peut avoir qu'une seule liste commune. Rappeler avec
 * `replace: true` pour remplacer volontairement.
 */
export async function attachSharedList(
  listId: string,
  body: {
    dateId?: string;
    // Champs tous optionnels : le serveur complète depuis la carte d'un
    // membre, qui décrit la même personne. `{ newDate: {} }` suffit donc.
    newDate?: {
      name?: string;
      surname?: string;
      date?: string;
      nameday?: string | null;
    };
    replace?: boolean;
  },
): Promise<{ ok: boolean; dateId: string }> {
  return api(`/shared-gifts/${listId}/attach`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface SharedListPending {
  _id: string;
  label: string | null;
  giftCount: number;
  from: { name: string; surname?: string } | null;
  suggestedCard?: SuggestedCard | null;
}

/**
 * Listes qu'on m'a partagées et qui ne sont encore rattachées à aucune de mes
 * cartes. Tant qu'une liste n'est pas rattachée, elle n'apparaît nulle part
 * dans l'app : c'est le seul moyen de la retrouver après avoir supprimé la
 * notification.
 */
export interface MySharedList {
  _id: string;
  label: string | null;
  role: SharedListRole;
  giftCount: number;
  memberCount: number;
  /** Carte qui porte la liste chez moi. Null si pas encore rattachée. */
  dateId: string | null;
  personName: string | null;
  from: { name: string; surname?: string } | null;
}

/**
 * Toutes mes listes communes, celles que je gère comme celles où je suis
 * invité. Complète fetchListsSharedWithMe, qui ne renvoie que les listes
 * reçues et non encore rattachées : une fois rattachée, une liste n'était plus
 * atteignable que par la carte de la personne concernée.
 */
export async function fetchMySharedLists(): Promise<MySharedList[]> {
  return api("/shared-gifts/mine");
}

export async function fetchListsSharedWithMe(): Promise<SharedListPending[]> {
  return api("/shared-gifts/shared-with-me");
}
