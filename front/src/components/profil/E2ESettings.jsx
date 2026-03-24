import React, { useState } from "react";
import useAuth from "../../context/useAuth";
import apiHandler from "../../api/apiHandler";
import {
  generateSeedPhrase,
  validateSeedPhrase,
  keyPairFromSeed,
  generateKeyPair,
  encryptPrivateKey,
  encryptSeedPhrase,
  decryptSeedPhrase,
  storePrivateKey,
  storeOldPrivateKey,
  getPrivateKey,
  clearPrivateKey,
} from "../../utils/encryption";

// ── Stepper ─────────────────────────────────────────────────────────────────

const Stepper = ({ current, total }) => (
  <div className="e2e-stepper">
    {Array.from({ length: total }, (_, i) => {
      const n = i + 1;
      const done = n < current;
      const active = n === current;
      return (
        <span
          key={n}
          className={`e2e-step${done ? " e2e-step--done" : ""}${active ? " e2e-step--active" : ""}`}
        >
          {done ? "✓" : n}
        </span>
      );
    })}
  </div>
);

// ── Seed phrase en grille 3×4 ────────────────────────────────────────────────

const SeedGrid = ({ phrase }) => (
  <div className="e2e-seed-grid">
    {phrase.split(" ").map((word, i) => (
      <div key={i} className="e2e-seed-word">
        <span className="e2e-seed-number">{i + 1}</span>
        <span className="e2e-seed-text">{word}</span>
      </div>
    ))}
  </div>
);

// ── Champ mot de passe avec toggle ──────────────────────────────────────────

const PasswordField = ({ value, onChange, placeholder = "Mot de passe", autoFocus = false }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="e2e-password-field">
      <input
        type={show ? "text" : "password"}
        className="auth-input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="e2e-toggle-pw"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        aria-label={show ? "Masquer" : "Afficher"}
      >
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
};

// ── Composant principal ──────────────────────────────────────────────────────

const E2ESettings = () => {
  const { currentUser, updateUser } = useAuth();

  const [view, setView] = useState("overview");
  // Seed générée en mémoire — effacée dès que le flow se termine
  const [seedPhrase, setSeedPhrase] = useState("");
  const [seedInput, setSeedInput] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revealedSeed, setRevealedSeed] = useState("");

  const userId = currentUser?._id?.toString();
  const isFullE2E = currentUser?.e2eMode === "full";

  const resetFlow = () => {
    setSeedPhrase("");
    setSeedInput("");
    setPassword("");
    setError("");
    setRevealedSeed("");
  };

  // ── Handlers ────────────────────────────────────────────────────────────

  const startStep2 = () => {
    setSeedPhrase(generateSeedPhrase());
    setView("step2");
  };

  const normalizeSeed = (str) =>
    str
      .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, " ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const verifySeed = () => {
    setError("");
    const trimmed = normalizeSeed(seedInput);
    if (trimmed !== normalizeSeed(seedPhrase)) {
      setError("La phrase ne correspond pas. Vérifiez l'ordre exact des 12 mots.");
      return;
    }
    if (!validateSeedPhrase(trimmed)) {
      setError("Phrase invalide (mots BIP39 incorrects).");
      return;
    }
    setView("step4");
  };

  const activateFullE2E = async () => {
    setError("");
    setLoading(true);
    try {
      const { publicKey, secretKey } = keyPairFromSeed(seedPhrase);
      const encryptedPrivateKey = encryptPrivateKey(secretKey, password, userId);
      const encryptedSeedPhraseVal = encryptSeedPhrase(seedPhrase, password, userId);

      await apiHandler.storeE2EKeys({
        publicKey,
        encryptedPrivateKey,
        e2eMode: "full",
        encryptedSeedPhrase: encryptedSeedPhraseVal,
      });

      // Archiver l'ancienne clé active avant de la remplacer
      const currentKey = getPrivateKey();
      if (currentKey) storeOldPrivateKey(currentKey);
      clearPrivateKey();
      storePrivateKey(secretKey);
      updateUser({
        ...currentUser,
        publicKey,
        encryptedPrivateKey,
        encryptedSeedPhrase: encryptedSeedPhraseVal,
        e2eMode: "full",
        e2eActivatedAt: new Date().toISOString(),
      });

      resetFlow();
      setView("overview");
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'activation.");
    } finally {
      setLoading(false);
    }
  };

  const viewSeedPhrase = async () => {
    setError("");
    setLoading(true);
    try {
      const phrase = decryptSeedPhrase(
        currentUser.encryptedSeedPhrase,
        password,
        userId
      );
      if (!phrase) {
        setError("Mot de passe incorrect.");
        return;
      }
      setRevealedSeed(phrase);
      setPassword("");
      setView("view-seed-reveal");
    } catch {
      setError("Erreur de déchiffrement.");
    } finally {
      setLoading(false);
    }
  };

  const deactivate = async () => {
    setError("");
    setLoading(true);
    try {
      const { publicKey, secretKey } = generateKeyPair();
      const encryptedPrivateKey = encryptPrivateKey(secretKey, password, userId);

      await apiHandler.storeE2EKeys({
        publicKey,
        encryptedPrivateKey,
        e2eMode: "standard",
        encryptedSeedPhrase: null,
      });

      // Archiver la clé Full E2E avant de revenir en mode standard
      const currentKey = getPrivateKey();
      if (currentKey) storeOldPrivateKey(currentKey);
      clearPrivateKey();
      storePrivateKey(secretKey);
      updateUser({
        ...currentUser,
        publicKey,
        encryptedPrivateKey,
        encryptedSeedPhrase: null,
        e2eMode: "standard",
        e2eActivatedAt: null,
      });

      resetFlow();
      setView("overview");
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de la désactivation.");
    } finally {
      setLoading(false);
    }
  };

  const ErrorMsg = () =>
    error ? <p className="e2e-error">{error}</p> : null;

  // ── Vue : aperçu (mode standard) ─────────────────────────────────────────

  if (view === "overview" && !isFullE2E) {
    return (
      <div className="e2e-section">
        <h3 className="e2e-title">Chiffrement Maximum (Full E2E)</h3>
        <p className="e2e-desc">
          Le mode standard protège déjà vos messages. Le Chiffrement Maximum
          ajoute une sécurité basée sur une phrase de 12 mots — indépendante
          de votre mot de passe.
        </p>
        <div className="e2e-info-box">
          <p>✅ Clé non liée à votre mot de passe — plus robuste</p>
          <p>⚠️ Si vous perdez vos 12 mots, vos messages seront inaccessibles</p>
          <p>⚠️ Les anciens messages (mode standard) ne seront pas re-chiffrés</p>
        </div>
        <button className="btn-profil e2e-btn-primary" onClick={() => setView("step1")}>
          Activer le Chiffrement Maximum
        </button>
      </div>
    );
  }

  // ── Vue : aperçu (mode Full E2E actif) ───────────────────────────────────

  if (view === "overview" && isFullE2E) {
    return (
      <div className="e2e-section">
        <div className="e2e-active-badge">🔐 Chiffrement Maximum actif</div>
        {currentUser.e2eActivatedAt && (
          <p className="e2e-meta">
            Activé le{" "}
            {new Date(currentUser.e2eActivatedAt).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
        <p className="e2e-desc">
          Vos messages sont chiffrés avec votre phrase de récupération de
          12 mots. Conservez-la précieusement — c'est votre seule façon
          d'accéder à vos messages depuis un nouvel appareil.
        </p>
        <div className="e2e-actions">
          {currentUser.encryptedSeedPhrase && (
            <button
              className="btn-profil"
              onClick={() => { setError(""); setView("view-seed-pw"); }}
            >
              Voir ma phrase de récupération
            </button>
          )}
          <button
            className="btn-profil e2e-btn-danger"
            onClick={() => { setError(""); setView("deactivate"); }}
          >
            Désactiver le Chiffrement Maximum
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1 : Avertissement ─────────────────────────────────────────────

  if (view === "step1") {
    return (
      <div className="e2e-section">
        <Stepper current={1} total={4} />
        <h3 className="e2e-title">⚠️ Avant d'activer le Chiffrement Maximum</h3>
        <div className="e2e-info-box">
          <p>✅ <strong>Vos messages actuels resteront lisibles</strong><br />BirthReminder conserve votre ancienne clé pour déchiffrer vos messages existants.</p>
          <p>💻 <strong>Fonctionne sur tous vos appareils</strong><br />Reconnectez-vous sur un autre appareil pour retrouver l'accès à tous vos messages.</p>
          <p>🔑 <strong>Vos 12 mots sont irremplaçables</strong><br />Si vous perdez votre phrase de 12 mots ET oubliez votre mot de passe, vos messages pendant la période chiffrée seront définitivement inaccessibles.</p>
          <p>⚠️ <strong>En cas de désactivation</strong><br />Vous perdrez uniquement les messages échangés pendant la période de Chiffrement Maximum. Vos messages antérieurs resteront lisibles.</p>
          <p>📝 Préparez crayon et papier, ou un gestionnaire de mots de passe</p>
          <p>🚫 Ne prenez pas de capture d'écran — risque de fuite</p>
        </div>
        <p className="e2e-desc">Vos amis, wishlists et événements ne sont jamais affectés.</p>
        <div className="e2e-nav">
          <button className="update-btn-secondary" onClick={() => { resetFlow(); setView("overview"); }}>
            Annuler
          </button>
          <button className="btn-profil e2e-btn-primary" onClick={startStep2}>
            Je comprends et j'accepte ces conditions
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2 : Affichage seed ────────────────────────────────────────────

  if (view === "step2") {
    return (
      <div className="e2e-section">
        <Stepper current={2} total={4} />
        <h3 className="e2e-title">Vos 12 mots de récupération</h3>
        <p className="e2e-desc">
          Notez ces mots <strong>dans l'ordre exact</strong>. Ne les partagez
          jamais.
        </p>
        <SeedGrid phrase={seedPhrase} />
        <div className="e2e-warning-box">
          <p>🔒 Ces mots n'apparaîtront qu'une seule fois.</p>
        </div>
        <div className="e2e-nav">
          <button className="update-btn-secondary" onClick={() => setView("step1")}>
            ← Retour
          </button>
          <button
            className="btn-profil e2e-btn-primary"
            onClick={() => { setSeedInput(""); setView("step3"); }}
          >
            J'ai noté mes 12 mots →
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3 : Vérification ──────────────────────────────────────────────

  if (view === "step3") {
    return (
      <div className="e2e-section">
        <Stepper current={3} total={4} />
        <h3 className="e2e-title">Vérification</h3>
        <p className="e2e-desc">
          Entrez vos 12 mots dans l'ordre exact pour confirmer que vous les
          avez notés.
        </p>
        <textarea
          className="e2e-textarea"
          placeholder="mot1 mot2 mot3 ... mot12"
          value={seedInput}
          onChange={(e) => { setSeedInput(e.target.value); setError(""); }}
          rows={3}
          autoFocus
        />
        <ErrorMsg />
        <div className="e2e-nav">
          <button className="update-btn-secondary" onClick={() => setView("step2")}>
            ← Retour
          </button>
          <button
            className="btn-profil e2e-btn-primary"
            onClick={verifySeed}
            disabled={!seedInput.trim()}
          >
            Vérifier →
          </button>
        </div>
      </div>
    );
  }

  // ── Step 4 : Mot de passe ─────────────────────────────────────────────

  if (view === "step4") {
    return (
      <div className="e2e-section">
        <Stepper current={4} total={4} />
        <h3 className="e2e-title">Confirmer votre mot de passe</h3>
        <p className="e2e-desc">
          Entrez votre mot de passe pour sécuriser votre nouvelle clé de
          chiffrement.
        </p>
        <PasswordField
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          autoFocus
        />
        <ErrorMsg />
        <div className="e2e-nav">
          <button
            className="update-btn-secondary"
            onClick={() => { setPassword(""); setView("step3"); }}
          >
            ← Retour
          </button>
          <button
            className="btn-profil e2e-btn-primary"
            onClick={activateFullE2E}
            disabled={!password || loading}
          >
            {loading ? "Activation…" : "Activer le Chiffrement Maximum"}
          </button>
        </div>
      </div>
    );
  }

  // ── Voir seed — saisie du mot de passe ───────────────────────────────

  if (view === "view-seed-pw") {
    return (
      <div className="e2e-section">
        <h3 className="e2e-title">🔐 Voir ma phrase de récupération</h3>
        <p className="e2e-desc">
          Entrez votre mot de passe pour déchiffrer vos 12 mots.
        </p>
        <PasswordField
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          autoFocus
        />
        <ErrorMsg />
        <div className="e2e-nav">
          <button
            className="update-btn-secondary"
            onClick={() => { resetFlow(); setView("overview"); }}
          >
            Annuler
          </button>
          <button
            className="btn-profil e2e-btn-primary"
            onClick={viewSeedPhrase}
            disabled={!password || loading}
          >
            {loading ? "Déchiffrement…" : "Afficher mes 12 mots"}
          </button>
        </div>
      </div>
    );
  }

  // ── Voir seed — affichage ─────────────────────────────────────────────

  if (view === "view-seed-reveal") {
    return (
      <div className="e2e-section">
        <h3 className="e2e-title">🔐 Votre phrase de récupération</h3>
        <p className="e2e-desc">
          Conservez ces mots en lieu sûr. Ne les partagez jamais.
        </p>
        <SeedGrid phrase={revealedSeed} />
        <div className="e2e-warning-box">
          <p>🔒 Fermez cette vue dès que vous avez noté vos mots.</p>
        </div>
        <button
          className="btn-profil"
          onClick={() => { setRevealedSeed(""); setView("overview"); }}
        >
          Fermer
        </button>
      </div>
    );
  }

  // ── Désactivation ─────────────────────────────────────────────────────

  if (view === "deactivate") {
    return (
      <div className="e2e-section">
        <h3 className="e2e-title">⚠️ Désactiver le Chiffrement Maximum ?</h3>
        <div className="e2e-warning-box">
          <p>Vous perdrez l'accès aux messages échangés <strong>pendant la période de chiffrement maximum</strong>.</p>
          <p>Vos messages antérieurs resteront lisibles.</p>
          <p>Un nouveau jeu de clés standard sera généré automatiquement.</p>
          <p><strong>Cette action est irréversible.</strong></p>
        </div>
        <p className="e2e-desc">Entrez votre mot de passe pour confirmer.</p>
        <PasswordField
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          autoFocus
        />
        <ErrorMsg />
        <div className="e2e-nav">
          <button
            className="update-btn-secondary"
            onClick={() => { resetFlow(); setView("overview"); }}
          >
            Annuler
          </button>
          <button
            className="btn-profil e2e-btn-danger"
            onClick={deactivate}
            disabled={!password || loading}
          >
            {loading ? "Désactivation…" : "Confirmer la désactivation"}
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default E2ESettings;
