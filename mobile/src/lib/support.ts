import { api } from "./api";

/** Envoie un message au support (→ support@birthreminder.com). */
export async function sendSupportMessage(
  subject: string,
  message: string,
): Promise<void> {
  await api("/support", {
    method: "POST",
    body: JSON.stringify({ subject, message }),
  });
}
