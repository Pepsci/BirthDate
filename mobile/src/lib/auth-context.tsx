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
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Api.AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // true = l'utilisateur affiché vient du cache (app ouverte hors ligne) : il
  // faut revalider la session dès que le serveur répond de nouveau.
  const fromCache = useRef(false);

  // Au démarrage : si un token est stocké, on vérifie la session
  useEffect(() => {
    (async () => {
      try {
        const token = await Api.getToken();
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
      if (!fromCache.current || running) return;
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
      if (s !== "active") return;
      revalidate();
      flushQueue(); // modifications faites hors ligne, s'il en reste
    });
    return () => {
      unsubscribe();
      appStateSub.remove();
    };
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
    await Api.login(email, password);
    const u = await Api.verify();
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
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
