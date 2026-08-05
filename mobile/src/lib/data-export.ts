import { api } from "./api";
import { getPrivateKey, getOldPrivateKey, decryptMessage } from "./crypto";

/**
 * Export RGPD (droit d'accès, art. 15).
 *
 * Le serveur ne peut pas produire un export lisible : les messages sont
 * chiffrés de bout en bout et il n'a pas la clé. Il renvoie donc le chiffré,
 * et c'est ici — sur l'appareil, où vit la clé privée — qu'on le déchiffre
 * avant d'écrire le fichier.
 *
 * Conséquence assumée : un export lancé depuis un appareil sans clé (nouvelle
 * installation, clé non restaurée) contient des messages non déchiffrés, avec
 * la raison indiquée à la place du texte.
 */

interface ExportMessage {
  _id: string;
  sentByYou: boolean;
  senderName: string | null;
  senderPublicKey: string | null;
  senderOldPublicKey: string | null;
  type?: string;
  isEncrypted: boolean;
  content: string;
  encryptedForYou: string | null;
  metadata?: unknown;
  edited?: boolean;
  createdAt: string;
}

interface ExportConversation {
  _id: string;
  with: string | null;
  createdAt: string;
  lastMessageAt: string;
  hiddenFromYouSince: string | null;
  messages: ExportMessage[];
}

export interface DataExport {
  exportedAt: string;
  about: string;
  profil: Record<string, unknown>;
  conversations: ExportConversation[];
  [key: string]: unknown;
}

function fetchExport(): Promise<DataExport> {
  return api<DataExport>("/users/me/export");
}

/**
 * Récupère l'export et remplace le contenu chiffré par le texte en clair.
 * On tente l'ancienne clé en second : les messages antérieurs à une rotation
 * de clés ne se déchiffrent qu'avec elle.
 */
export async function buildReadableExport(): Promise<DataExport> {
  const data = await fetchExport();
  const [privateKey, oldPrivateKey] = await Promise.all([
    getPrivateKey(),
    getOldPrivateKey(),
  ]);

  const decrypt = (m: ExportMessage): string => {
    if (!m.isEncrypted) return m.content;
    if (!m.encryptedForYou) return "[chiffré — aucune copie pour ce compte]";
    const keys = [privateKey, oldPrivateKey].filter(Boolean) as Uint8Array[];
    if (keys.length === 0) {
      return "[chiffré — clé privée absente de cet appareil]";
    }
    // Le serveur a déjà replié senderPublicKey sur l'empreinte si le compte
    // de l'expéditeur a été purgé.
    const publicKeys = [m.senderPublicKey, m.senderOldPublicKey].filter(
      Boolean,
    ) as string[];
    for (const pk of publicKeys) {
      for (const key of keys) {
        const clear = decryptMessage(m.encryptedForYou, pk, key);
        if (clear !== null) return clear;
      }
    }
    return "[chiffré — déchiffrement impossible]";
  };

  return {
    ...data,
    conversations: (data.conversations || []).map((conv) => ({
      ...conv,
      messages: (conv.messages || []).map((m) => {
        const { encryptedForYou, senderPublicKey, senderOldPublicKey, ...rest } =
          m;
        return { ...rest, content: decrypt(m) };
      }) as ExportMessage[],
    })),
  };
}
