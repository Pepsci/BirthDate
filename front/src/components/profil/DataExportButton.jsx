import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";
import {
  getPrivateKey,
  getOldPrivateKey,
  decryptMessage,
} from "../../utils/encryption";

/**
 * Téléchargement des données personnelles (RGPD art. 15 et 20).
 *
 * Le serveur renvoie les messages chiffrés : il n'a pas la clé privée et ne
 * peut donc pas produire un export lisible. Le déchiffrement a lieu ici, dans
 * le navigateur, avant la génération du fichier.
 */
const DataExportButton = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const decryptAll = (data) => {
    const privateKey = getPrivateKey();
    const oldPrivateKey = getOldPrivateKey();
    const keys = [privateKey, oldPrivateKey].filter(Boolean);

    const toClear = (m) => {
      if (!m.isEncrypted) return m.content;
      if (!m.encryptedForYou) return "[chiffré — aucune copie pour ce compte]";
      if (keys.length === 0) {
        return "[chiffré — clé privée absente de ce navigateur]";
      }
      const publicKeys = [m.senderPublicKey, m.senderOldPublicKey].filter(
        Boolean,
      );
      for (const pk of publicKeys) {
        const clear = decryptMessage(m.encryptedForYou, pk, keys);
        if (clear) return clear;
      }
      return "[chiffré — déchiffrement impossible]";
    };

    return {
      ...data,
      conversations: (data.conversations || []).map((conv) => ({
        ...conv,
        messages: (conv.messages || []).map((m) => {
          const {
            encryptedForYou,
            senderPublicKey,
            senderOldPublicKey,
            ...rest
          } = m;
          return { ...rest, content: toClear(m) };
        }),
      })),
    };
  };

  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const { data } = await apiHandler.get("/users/me/export");
      const readable = decryptAll(data);

      const blob = new Blob([JSON.stringify(readable, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `birthreminder-mes-donnees-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (e) {
      console.error(e);
      setError(
        e?.response?.data?.message ?? "Export impossible pour le moment.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="data-export-zone">
      <p className="data-export-text">
        Vous pouvez récupérer une copie de toutes vos données : profil, dates,
        amis, cadeaux, événements, conversations et journal d'activité. Vos
        messages étant chiffrés de bout en bout, ils sont déchiffrés dans votre
        navigateur au moment de l'export.
      </p>
      <button
        type="button"
        className="update-btn-secondary"
        onClick={handleExport}
        disabled={busy}
      >
        {busy ? "Préparation…" : "Télécharger mes données"}
      </button>
      {done && (
        <p className="data-export-done">Fichier téléchargé.</p>
      )}
      {error && <p className="data-export-error">{error}</p>}
    </div>
  );
};

export default DataExportButton;
