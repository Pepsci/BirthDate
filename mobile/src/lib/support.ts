import { api } from "./api";

/** Envoie un message au support (→ support@birthreminder.com). */
export async function sendSupportMessage(
  subject: string,
  message: string,
  /**
   * Cagnotte concernée, pour un litige de participation.
   *
   * ⚠️ Deux effets côté serveur : le ticket est rattaché à l'événement (l'admin
   * ouvre directement les contributions au lieu de deviner), et il échappe à la
   * règle du ticket unique — un litige d'argent ne doit pas être bloqué par une
   * question en cours sur autre chose. Le plafond devient un ticket ouvert par
   * cagnotte.
   */
  eventShortId?: string,
  /**
   * ⚠️ Indépendant de `eventShortId`, et c'est essentiel : une contribution
   * dont l'événement a été supprimé n'a plus d'identifiant. Si la catégorie
   * dépendait de l'événement, ces demandes repartiraient en « général » et se
   * feraient refuser au profit d'une conversation en cours sur autre chose.
   */
  category?: "pool",
): Promise<void> {
  await api("/support", {
    method: "POST",
    body: JSON.stringify({ subject, message, eventShortId, category }),
  });
}
