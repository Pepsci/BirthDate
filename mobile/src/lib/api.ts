import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";

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
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Client API générique : ajoute automatiquement le header Authorization: Bearer.
 * Le middleware backend (jwt.middleware.js) accepte déjà ce mode.
 */
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  // Toutes les routes du backend sont préfixées par /api (cf. server/app.js)
  const res = await fetch(`${API_URL}/api${path}`, { ...options, headers });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // réponse sans body JSON
  }

  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? `Erreur ${res.status}`);
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
