import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { AppState } from "react-native";
import * as Api from "./api";
import { setupE2EKeys, clearPrivateKey } from "./crypto";
import { registerForPush, unregisterPush } from "./push";
import {
  clearCache,
  readCache,
  setCacheOwner,
  writeCache,
} from "./offline-cache";
import { subscribeOfflineStatus, isOffline } from "./offline-status";
import {
  flushQueue,
  loadQueue,
  resetQueue,
  startQueueSync,
} from "./offline-queue";
import {
  AppMode,
  isLocalMode,
  loadAppMode,
  setAppMode,
  withServerAccess,
} from "./app-mode";
import { clearLocalData } from "./local-store";
import { startLocalReminders, stopLocalReminders } from "./local-reminders";
import { hasLocalDataToImport } from "./local-migration";

const ME_CACHE_KEY = "me";

/**
 * Champs du profil jamais écrits sur le disque, même dans le sandbox de
 * l'app : le token (déjà dans le SecureStore) et les clés E2E chiffrées.
 */
const NEVER_CACHED = [
  "authToken",
  "encryptedPrivateKey",
  "oldEncryptedPrivateKey",
  "encryptedSeedPhrase",
];

function cacheableUser(u: Api.AuthUser): Api.AuthUser {
  const copy: Record<string, unknown> = { ...u };
  for (const k of NEVER_CACHED) delete copy[k];
  return copy as Api.AuthUser;
}

/**
 * Session serveur confirmée : on mémorise le propriétaire du cache et une
 * copie du profil, qui servira à rouvrir l'app sans réseau.
 */
function rememberUser(u: Api.AuthUser) {
  setCacheOwner(String(u._id));
  writeCache(ME_CACHE_KEY, cacheableUser(u));
}

/**
 * Faut-il garder la session malgré l'échec de /auth/verify ?
 * Oui si le serveur est injoignable (réseau, délai) ou en panne (5xx).
 * Non s'il a répondu par un refus (401, 403…) : la session est vraiment finie.
 */
function isTransientFailure(e: unknown): boolean {
  if (e instanceof Api.NetworkError) return true;
  return e instanceof Api.ApiError && e.status >= 500;
}

interface AuthContextValue {
  user: Api.AuthUser | null;
  /**
   * "account" | "local" | null (premier lancement, pas encore choisi).
   * En mode local, `user` reste null : c'est un état « sans compte mais
   * autorisé » (docs/MODE_LOCAL.md § 5.2).
   */
  mode: AppMode;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  /**
   * Compte connecté ET cartes du mode local encore sur le téléphone : l'app
   * propose de les importer (écran /local-import). Faux après « Plus tard »,
   * jusqu'au prochain lancement.
   */
  localImportPending: boolean;
  /** Relit l'état (après un import ou un abandon). */
  refreshLocalImport: () => Promise<void>;
  /** « Plus tard » : ne plus proposer pendant cette session. */
  postponeLocalImport: () => void;
  /** Choix « Utiliser sans compte ». Refusé si un compte est connecté. */
  enterLocalMode: () => Promise<void>;
  /**
   * « Effacer toutes mes données » : supprime les données locales et revient
   * au choix initial. IRRÉVERSIBLE — l'écran doit avoir confirmé deux fois.
   */
  leaveLocalMode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Api.AuthUser | null>(null);
  const [mode, setMode] = useState<AppMode>(null);
  const [localImportPending, setLocalImportPending] = useState(false);
  const importPostponed = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  // true = l'utilisateur affiché vient du cache (app ouverte hors ligne) : il
  // faut revalider la session dès que le serveur répond de nouveau.
  const fromCache = useRef(false);

  // Au démarrage : si un token est stocké, on vérifie la session
  useEffect(() => {
    (async () => {
      try {
        const token = await Api.getToken();
        // Le mode est lu AVANT tout appel serveur : en mode local, api()
        // refuse de partir, et on ne veut ni verify ni enregistrement push.
        const m = await loadAppMode(!!token);
        setMode(m);
        if (m === "local") return; // pas de session serveur à vérifier
        if (token) {
          const u = await Api.verify();
          rememberUser(u);
          setUser(u);
          registerForPush(); // silencieux si Expo Go / permission refusée
        }
      } catch (e) {
        // ⚠️ Avant le cache, TOUT échec vidait le token : ouvrir l'app sans
        // réseau déconnectait l'utilisateur. On ne le fait plus que sur un
        // vrai refus du serveur.
        if (isTransientFailure(e)) {
          const cached = await readCache<Api.AuthUser>(ME_CACHE_KEY, {
            anyOwner: true,
          });
          if (cached) {
            setCacheOwner(cached.userId);
            fromCache.current = true;
            setUser(cached.data);
          }
          // Sans profil en cache : écran de connexion, mais le token est
          // conservé pour le prochain lancement en ligne.
        } else {
          await Api.clearToken();
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Revalidation d'une session ouverte depuis le cache : au retour du réseau
  // ET au retour de l'app au premier plan (cas d'un serveur en panne au
  // lancement : aucune bascule hors ligne → en ligne ne se produit alors).
  useEffect(() => {
    let running = false;
    const revalidate = () => {
      if (isLocalMode() || !fromCache.current || running) return;
      running = true;
      Api.verify()
        .then((u) => {
          fromCache.current = false;
          rememberUser(u);
          setUser(u);
          registerForPush();
        })
        .catch(async (e) => {
          if (isTransientFailure(e)) return; // on retentera plus tard
          // Session refusée pendant l'absence de réseau : déconnexion propre
          fromCache.current = false;
          await Api.clearToken();
          resetQueue();
          await clearCache();
          setCacheOwner(null);
          setUser(null);
        })
        .finally(() => {
          running = false;
        });
    };
    const unsubscribe = subscribeOfflineStatus(() => {
      if (!isOffline()) revalidate();
    });
    const appStateSub = AppState.addEventListener("change", (s) => {
      if (s !== "active" || isLocalMode()) return;
      revalidate();
      flushQueue(); // modifications faites hors ligne, s'il en reste
    });
    return () => {
      unsubscribe();
      appStateSub.remove();
    };
  }, []);

  // Rappels locaux : actifs en mode local uniquement. Dans tout autre mode,
  // on annule — y compris au démarrage en mode compte, pour nettoyer une
  // session locale précédente (sinon doublon avec les push du serveur).
  useEffect(() => {
    if (isLoading) return;
    if (mode === "local") startLocalReminders();
    else stopLocalReminders();
  }, [mode, isLoading]);

  // Données du mode local restées sur le téléphone après une connexion :
  // vérifié à chaque connexion ET au démarrage (app fermée en plein import).
  const refreshLocalImport = useCallback(async () => {
    if (mode !== "account" || !user || importPostponed.current) {
      setLocalImportPending(false);
      return;
    }
    try {
      setLocalImportPending(await hasLocalDataToImport());
    } catch {
      setLocalImportPending(false);
    }
  }, [mode, user]);

  useEffect(() => {
    refreshLocalImport();
  }, [refreshLocalImport]);

  const postponeLocalImport = useCallback(() => {
    importPostponed.current = true;
    setLocalImportPending(false);
  }, []);

  // File d'attente hors ligne du compte connecté : chargée dès qu'on sait qui
  // est connecté (le propriétaire du cache est fixé avant setUser), puis
  // envoyée au retour du réseau.
  const userId = user?._id ? String(user._id) : null;
  useEffect(() => {
    if (!userId) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    loadQueue().then(() => {
      if (!cancelled) stop = startQueueSync();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [userId]);

  const signIn = useCallback(async (email: string, password: string) => {
    // Depuis le mode local, api() refuserait la requête : accès serveur
    // accordé le temps de la tentative, et le mode ne passe à « compte »
    // qu'une fois la connexion réussie. En cas d'échec, on reste en local.
    // ⚠️ Les données locales ne sont PAS effacées ici : l'import vers le
    // compte (étape 6) s'en charge, après confirmation du serveur.
    const u = await withServerAccess(async () => {
      await Api.login(email, password);
      return Api.verify();
    });
    await setAppMode("account");
    setMode("account");
    rememberUser(u);
    // Clés E2E : déchiffrées avec le mot de passe (jamais envoyé au serveur)
    try {
      await setupE2EKeys(password, u as any);
    } catch (e) {
      console.warn("E2E setup failed:", e);
    }
    setUser(u);
    registerForPush();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const u = await Api.verify();
      rememberUser(u);
      setUser(u);
    } catch {
      // session expirée — on garde l'état courant
    }
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPush();
    await Api.logout();
    await clearPrivateKey();
    // Téléphone partagé : le compte suivant ne doit rien voir du précédent
    resetQueue();
    await clearCache();
    setCacheOwner(null);
    // Retour au choix initial (compte ou sans compte). Les données locales
    // éventuelles ne sont pas concernées : elles ne sont jamais vidées ici.
    await setAppMode(null);
    setMode(null);
    setUser(null);
  }, []);

  const enterLocalMode = useCallback(async () => {
    if (user) {
      // Repasser d'un compte au mode local n'est pas prévu pour l'instant
      // (MODE_LOCAL.md § 7) : il faudrait d'abord se déconnecter.
      throw new Error("Déconnecte-toi avant d'utiliser l'app sans compte.");
    }
    await setAppMode("local");
    setMode("local");
  }, [user]);

  const leaveLocalMode = useCallback(async () => {
    await clearLocalData();
    await setAppMode(null);
    setMode(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        mode,
        localImportPending,
        refreshLocalImport,
        postponeLocalImport,
        isLoading,
        signIn,
        signOut,
        refresh,
        enterLocalMode,
        leaveLocalMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
