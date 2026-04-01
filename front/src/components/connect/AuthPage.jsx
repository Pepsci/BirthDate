import React, { useState, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import { AuthContext } from "../../context/auth.context";
import PasswordInput from "./PasswordInput";
import DatePickerMobile from "../dashboard/DatePickerMobile";
import {
  generateKeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
  storePrivateKey,
  storeOldPrivateKey,
  getOldPrivateKey,
} from "../../utils/encryption";
import "./authpage.css";

// ── Initialisation des clés E2E après login ───────────────────────────────────
// Appelé à chaque login avec le mot de passe en clair et les données utilisateur.
// Cas couverts :
//   1. Première connexion / après reset mdp → génère + uploade une nouvelle paire
//   2. Connexion normale                    → déchiffre la clé privée existante
//   3. Déchiffrement échoue (corrompu)      → régénère (fallback silencieux)
async function setupE2EKeys(password, userData) {
  const { _id, publicKey, encryptedPrivateKey, oldEncryptedPrivateKey } =
    userData;
  const userId = _id.toString();

  if (!publicKey || !encryptedPrivateKey) {
    // Première connexion ou après un reset de mot de passe
    const { publicKey: newPubKey, secretKey } = generateKeyPair();
    const encKey = encryptPrivateKey(secretKey, password, userId);
    await apiHandler.storeE2EKeys({
      publicKey: newPubKey,
      encryptedPrivateKey: encKey,
    });
    storePrivateKey(secretKey);
    return;
  }

  // Connexion normale : déchiffre la clé privée stockée en DB
  const privateKey = decryptPrivateKey(encryptedPrivateKey, password, userId);
  if (privateKey) {
    storePrivateKey(privateKey);
    // Si une ancienne clé existe en DB (après changement de mode E2E),
    // la déchiffrer et la stocker pour accéder aux anciens messages
    const oldPrivateKey = oldEncryptedPrivateKey
      ? decryptPrivateKey(oldEncryptedPrivateKey, password, userId)
      : null;
    // Guard : ne pas écraser une oldPrivateKey déjà en session
    // (protège contre un deuxième appel sans oldEncryptedPrivateKey)
    if (oldPrivateKey && !getOldPrivateKey()) {
      storeOldPrivateKey(oldPrivateKey);
    }
    return;
  }

  // Fallback : déchiffrement échoué → régénère une nouvelle paire
  // (ne devrait pas arriver en flux normal, mais garantit la robustesse)
  const { publicKey: newPubKey, secretKey } = generateKeyPair();
  const encKey = encryptPrivateKey(secretKey, password, userId);
  await apiHandler.storeE2EKeys({
    publicKey: newPubKey,
    encryptedPrivateKey: encKey,
  });
  storePrivateKey(secretKey);
}

const AuthPage = () => {
  const [panel, setPanel] = useState("login"); // "login" | "signup" | "forgot"

  const navigate = useNavigate();
  const location = useLocation();
  const { storeToken, authenticateUser, setUserSession, isLoggedIn } =
    useContext(AuthContext);

  const from = location.state?.from?.pathname || "/home";
  const isFromFriends = location.state?.from?.search?.includes("tab=friends");

  useEffect(() => {
    const path = location.pathname;
    if (path === "/signup") setPanel("signup");
    else if (path === "/forgot-password") setPanel("forgot");
    else setPanel("login");
  }, [location.pathname]);

  navigate;
  useEffect(() => {
    if (isLoggedIn) navigate(from);
  }, [isLoggedIn]);

  // ─── LOGIN ───────────────────────────────────────────
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [loginError, setLoginError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      // Étape 1 : authentification classique → cookie httpOnly posé par le serveur
      const response = await apiHandler.signin({
        email: loginData.email,
        password: loginData.password,
        rememberMe: loginData.rememberMe,
      });
      storeToken(response.authToken);

      // Étape 2 : récupère les données complètes de l'utilisateur (incluant les champs E2E)
      const fullUserData = await apiHandler.isLoggedIn();
      const { authToken: newToken, ...user } = fullUserData;
      if (newToken) storeToken(newToken);

      // Étape 3 : initialise les clés E2E (génère ou déchiffre la clé privée)
      // Le mot de passe en clair n'est disponible qu'ici — il ne quitte pas le client
      await setupE2EKeys(loginData.password, user);

      // Étape 4 : met à jour le contexte auth sans second appel API
      setUserSession(user);
      navigate(from);
    } catch (err) {
      setLoginError(
        err.message === "Network Error"
          ? "Email ou mot de passe incorrect."
          : err.message || "Une erreur s'est produite.",
      );
    }
  };

  // ─── SIGNUP ──────────────────────────────────────────
  const [signupData, setSignupData] = useState({
    name: "",
    surname: "",
    email: "",
    password: "",
    birthDate: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError("");
    setSignupSuccess("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupData.email)) {
      setSignupError("Veuillez fournir une adresse e-mail valide.");
      return;
    }
    if (signupData.password !== confirmPassword) {
      setSignupError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!signupData.birthDate) {
      setSignupError("Veuillez renseigner votre date de naissance.");
      return;
    }

    try {
      await apiHandler.signup({
        ...signupData,
        email: signupData.email.toLowerCase(),
      });
      setSignupSuccess(
        "Compte créé ! Vérifiez votre boîte mail avant de vous connecter. 📧",
      );
      setTimeout(() => navigate("/auth"), 4000);
    } catch (err) {
      setSignupError(err.message || "Une erreur s'est produite.");
    }
  };

  // ─── FORGOT PASSWORD ─────────────────────────────────
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotError, setForgotError] = useState("");

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotMsg("");
    setForgotError("");
    try {
      await apiHandler.requestPasswordReset(forgotEmail);
      setForgotMsg(
        "Email de réinitialisation envoyé ! Vérifiez votre boîte mail.",
      );
    } catch (err) {
      setForgotError("Une erreur s'est produite. Vérifiez l'adresse email.");
    }
  };

  // ─── HELPERS ─────────────────────────────────────────
  const inkPos =
    panel === "signup" ? "33.33%" : panel === "forgot" ? "66.66%" : "0%";

  return (
    <div className="auth-page">
      <div className="auth-shell">
        {/* ── TABS ── */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${panel === "login" ? "active" : ""}`}
            onClick={() => setPanel("login")}
          >
            Connexion
          </button>
          <button
            className={`auth-tab ${panel === "signup" ? "active" : ""}`}
            onClick={() => setPanel("signup")}
          >
            Inscription
          </button>
          <button
            className={`auth-tab ${panel === "forgot" ? "active" : ""}`}
            onClick={() => setPanel("forgot")}
          >
            Mot de passe
          </button>
          <div
            className="auth-ink"
            style={{
              transform: `translateX(${panel === "login" ? "0%" : panel === "signup" ? "100%" : "200%"})`,
            }}
          />
        </div>

        {/* ── PANELS TRACK ── */}
        <div
          className="auth-track"
          style={{
            transform: `translateX(${panel === "login" ? "0%" : panel === "signup" ? "-33.333%" : "-66.666%"})`,
          }}
        >
          {/* ── LOGIN PANEL ── */}
          <div className="auth-panel">
            <div className="auth-panel-header">
              <h2 className="auth-title">Bon retour 👋</h2>
              <p className="auth-sub">Connectez-vous à votre compte</p>
            </div>

            {isFromFriends && (
              <div className="auth-info-banner">
                Connectez-vous pour voir votre demande d'ami
              </div>
            )}

            <form onSubmit={handleLogin} className="auth-form">
              <div className="auth-field">
                <label className="auth-label">Email</label>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="vous@exemple.com"
                  value={loginData.email}
                  onChange={(e) =>
                    setLoginData({
                      ...loginData,
                      email: e.target.value.toLowerCase(),
                    })
                  }
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Mot de passe</label>
                <PasswordInput
                  className="auth-input"
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                />
              </div>

              <button
                type="button"
                className="auth-forgot-link"
                onClick={() => setPanel("forgot")}
              >
                Mot de passe oublié ?
              </button>
              <div className="auth-remember">
                <label className="auth-remember-label">
                  <input
                    type="checkbox"
                    checked={loginData.rememberMe}
                    onChange={(e) =>
                      setLoginData({
                        ...loginData,
                        rememberMe: e.target.checked,
                      })
                    }
                  />
                  <span>Rester connecté</span>
                </label>
              </div>

              {loginError && (
                <p className="auth-msg auth-msg--error">{loginError}</p>
              )}

              <button type="submit" className="auth-btn-primary">
                Se connecter
              </button>
            </form>

            <p className="auth-switch-text">
              Pas encore de compte ?{" "}
              <button
                className="auth-link-btn"
                onClick={() => setPanel("signup")}
              >
                Créer un compte
              </button>
            </p>
          </div>

          {/* ── SIGNUP PANEL ── */}
          <div className="auth-panel">
            <div className="auth-panel-header">
              <h2 className="auth-title">Créer un compte</h2>
              <p className="auth-sub">Rejoignez BirthReminder gratuitement</p>
            </div>

            <form onSubmit={handleSignup} className="auth-form">
              <div className="auth-row">
                <div className="auth-field">
                  <label className="auth-label">Prénom</label>
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="Jean"
                    value={signupData.name}
                    onChange={(e) =>
                      setSignupData({ ...signupData, name: e.target.value })
                    }
                  />
                </div>
                <div className="auth-field">
                  <label className="auth-label">Nom</label>
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="Dupond"
                    value={signupData.surname}
                    onChange={(e) =>
                      setSignupData({ ...signupData, surname: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">Email</label>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="vous@exemple.com"
                  value={signupData.email}
                  onChange={(e) =>
                    setSignupData({ ...signupData, email: e.target.value })
                  }
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Date de naissance</label>
                <DatePickerMobile
                  value={signupData.birthDate}
                  max={`${new Date().getFullYear()}-12-31`}
                  onChange={(val) =>
                    setSignupData({ ...signupData, birthDate: val })
                  }
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Mot de passe</label>
                <PasswordInput
                  className="auth-input"
                  placeholder="••••••••"
                  value={signupData.password}
                  onChange={(e) =>
                    setSignupData({ ...signupData, password: e.target.value })
                  }
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Confirmer le mot de passe</label>
                <PasswordInput
                  className="auth-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {/* Avatar chip */}
              <div className="auth-avatar-chip">
                <img
                  src={`https://api.dicebear.com/8.x/bottts/svg?seed=${signupData.name || "BR"}`}
                  alt="avatar"
                  className="auth-avatar-img"
                />
                <div>
                  <strong className="auth-avatar-name">
                    {signupData.name
                      ? `${signupData.name} (votre avatar)`
                      : "Votre avatar"}
                  </strong>
                  <span className="auth-avatar-sub">
                    Généré depuis votre prénom
                  </span>
                </div>
              </div>

              {signupError && (
                <p className="auth-msg auth-msg--error">{signupError}</p>
              )}
              {signupSuccess && (
                <p className="auth-msg auth-msg--success">{signupSuccess}</p>
              )}

              <button type="submit" className="auth-btn-primary">
                Créer mon compte
              </button>
            </form>

            <p className="auth-switch-text">
              Déjà un compte ?{" "}
              <button
                className="auth-link-btn"
                onClick={() => setPanel("login")}
              >
                Se connecter
              </button>
            </p>
          </div>

          {/* ── FORGOT PASSWORD PANEL ── */}
          <div className="auth-panel">
            <div className="auth-panel-header">
              <h2 className="auth-title">Mot de passe oublié</h2>
              <p className="auth-sub">
                Entrez votre email pour recevoir un lien de réinitialisation
              </p>
            </div>

            <form onSubmit={handleForgot} className="auth-form">
              <div className="auth-field">
                <label className="auth-label">Email</label>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="vous@exemple.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
              </div>

              {forgotError && (
                <p className="auth-msg auth-msg--error">{forgotError}</p>
              )}
              {forgotMsg && (
                <p className="auth-msg auth-msg--success">{forgotMsg}</p>
              )}

              <button type="submit" className="auth-btn-primary">
                Envoyer le lien
              </button>
            </form>

            <p className="auth-switch-text">
              <button
                className="auth-link-btn"
                onClick={() => setPanel("login")}
              >
                ← Retour à la connexion
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
