import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import * as Api from "./api";
import { setupE2EKeys, clearPrivateKey } from "./crypto";
import { registerForPush, unregisterPush } from "./push";

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

  // Au démarrage : si un token est stocké, on vérifie la session
  useEffect(() => {
    (async () => {
      try {
        const token = await Api.getToken();
        if (token) {
          const u = await Api.verify();
          setUser(u);
          registerForPush(); // silencieux si Expo Go / permission refusée
        }
      } catch {
        await Api.clearToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await Api.login(email, password);
    const u = await Api.verify();
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
      setUser(u);
    } catch {
      // session expirée — on garde l'état courant
    }
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPush();
    await Api.logout();
    await clearPrivateKey();
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
