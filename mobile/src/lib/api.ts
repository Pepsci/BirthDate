import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { markOffline, markOnline } from "./offline-status";
import { assertAccountMode } from "./app-mode";

// URL de l'API — définie dans .env (EXPO_PUBLIC_API_URL)
// En dev : l'IP locale de ton PC sur le réseau (pas "localhost", qui pointerait vers le téléphone)
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.10:4000";

const TOKEN_KEY = "authToken";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  /**
   * Code machine renvoyé par le serveur (TERMS_REQUIRED, POOL_NOT_SETTLED…),
   * pour distinguer un refus métier attendu d'une panne.
   */
  code?: string;
  /**
   * Précision technique accompagnant le message.
   *
   * ⚠️ Sans elle, un refus de Stripe arrivait sur mobile réduit à « Erreur
   * lors de la connexion Stripe » : le serveur nommait pourtant le champ
   * fautif. On perdait l'information au dernier mètre, et il fallait aller
   * lire les logs serveur pour une cause souvent triviale.
   */
  detail?: string;

  constructor(
    status: number,
    message: string,
    extra?: { code?: string; detail?: string },
  ) {
    super(message);
    this.status = status;
    this.code = extra?.code;
    this.detail = extra?.detail;
  }
}

/**
 * Le serveur n'a pas répondu du tout : pas de réseau, délai dépassé, serveur
 * éteint. À distinguer d'une ApiError (le serveur a répondu, avec un refus).
 *
 * C'est ce qui autorise le repli sur le cache hors ligne : on ne doit JAMAIS
 * se rabattre sur le cache après un 401 (session expirée) ou un 403.
 */
export class NetworkError extends Error {
  constructor() {
    super("Pas de connexion au serveur. Réessaie une fois en ligne.");
    this.name = "NetworkError";
  }
}

/** Au-delà, une requête est considérée perdue (réseau très dégradé). */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Client API générique : ajoute automatiquement le header Authorization: Bearer.
 * Le middleware backend (jwt.middleware.js) accepte déjà ce mode.
 */
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Mode local : aucune requête ne part vers le serveur (docs/MODE_LOCAL.md).
  // Lève AVANT tout accès réseau — un oubli d'aiguillage se voit tout de suite.
  assertAccountMode(`api ${options.method ?? "GET"} ${path}`);
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  // Délai maximal, sauf si l'appelant gère déjà son propre signal
  const controller = options.signal ? null : new AbortController();
  const timer = controller
    ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    : null;

  // Toutes les routes du backend sont préfixées par /api (cf. server/app.js)
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      ...options,
      headers,
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (err) {
    // Annulation voulue par l'appelant (écran quitté) : ce n'est pas une panne
    if (options.signal?.aborted) throw err;
    // Sinon fetch ne rejette que si aucune réponse n'est arrivée (réseau, délai)
    markOffline();
    throw new NetworkError();
  } finally {
    if (timer) clearTimeout(timer);
  }
  markOnline();

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // réponse sans body JSON
  }

  if (!res.ok) {
    // Le détail est concaténé au message : tous les écrans affichent
    // `e.message`, et une information qui n'atteint pas l'écran ne sert à rien.
    // Il reste accessible séparément via `error.detail` si besoin.
    const base = data?.message ?? `Erreur ${res.status}`;
    const detail = data?.detail || null;
    throw new ApiError(
      res.status,
      detail ? `${base} — ${detail}` : base,
      { code: data?.code, detail },
    );
  }
  return data as T;
}

// ---- Auth ----

export interface AuthUser {
  _id: string;
  email: string;
  name: string;
  surname: string;
  [key: string]: unknown;
}

/** Version affichée à l'admin (support & débogage) — celle d'app.json. */
export const APP_VERSION = Constants.expoConfig?.version ?? null;

export async function login(
  email: string,
  password: string,
  rememberMe = true,
): Promise<string> {
  const { authToken } = await api<{ authToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      rememberMe,
      platform: Platform.OS,
      appVersion: APP_VERSION,
    }),
  });
  await setToken(authToken);
  return authToken;
}

export async function verify(): Promise<AuthUser> {
  // /auth/verify renvoie l'utilisateur + un authToken rafraîchi
  const user = await api<AuthUser & { authToken: string }>("/auth/verify");
  if (user.authToken) await setToken(user.authToken);
  return user;
}

export async function logout(): Promise<void> {
  await clearToken();
}
