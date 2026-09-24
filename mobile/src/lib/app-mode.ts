import * as SecureStore from "expo-secure-store";

/**
 * Mode de fonctionnement de l'app :
 * - "account" : compte BirthReminder, données sur le serveur ;
 * - "local"   : sans compte, tout reste sur le téléphone (docs/MODE_LOCAL.md) ;
 * - null      : premier lancement, pas encore choisi.
 *
 * Pourquoi un module et pas seulement un état React : `api()`, le socket et
 * les uploads ne sont pas des composants, ils ne peuvent pas lire un contexte.
 * La valeur vit donc ici (en mémoire, lecture synchrone) et auth-context en
 * garde un miroir pour faire re-rendre les écrans.
 *
 * Persisté dans le SecureStore (petite valeur, déjà utilisé pour le token).
 */
export type AppMode = "account" | "local" | null;

/**
 * Le mode local est-il proposé dans l'interface ?
 *
 * Activé le 24/09/2026 : l'étape 6 (import des cartes locales dans un compte,
 * app/local-import.tsx) est terminée et testée. Un utilisateur local qui crée
 * un compte retrouve donc ses cartes.
 *
 * ⚠️ C'était `__DEV__`, donc vrai sous Metro et FAUX dans tout build de
 * release : le bouton « Utiliser sans compte » et la proposition faite aux
 * moins de 15 ans n'existaient ni sur TestFlight ni sur le Play Store, alors
 * que le parcours fonctionnait parfaitement en développement.
 */
export const LOCAL_MODE_READY = true;

const MODE_KEY = "appMode";

let mode: AppMode = null;

/** > 0 pendant une connexion / inscription lancée depuis le mode local. */
let serverAccess = 0;

/**
 * Autorise le serveur le temps d'UNE action explicite de l'utilisateur
 * (se connecter, créer un compte) sans quitter le mode local.
 *
 * Pourquoi pas simplement setAppMode("account") pendant la tentative : ce
 * choix est enregistré. Un plantage entre les deux laisserait l'app en mode
 * compte sans token → écran de connexion, cartes locales inaccessibles.
 * Ici, rien n'est enregistré : le mode ne change qu'après la réussite.
 */
export async function withServerAccess<T>(fn: () => Promise<T>): Promise<T> {
  serverAccess++;
  try {
    return await fn();
  } finally {
    serverAccess--;
  }
}

export function getAppMode(): AppMode {
  return mode;
}

export function isLocalMode(): boolean {
  return mode === "local";
}

/**
 * Lu une fois au démarrage (auth-context).
 *
 * Rétrocompatibilité : les utilisateurs d'avant le mode local n'ont aucune
 * valeur enregistrée. S'ils ont un token, ils sont en mode compte.
 */
export async function loadAppMode(hasToken: boolean): Promise<AppMode> {
  let stored: string | null = null;
  try {
    stored = await SecureStore.getItemAsync(MODE_KEY);
  } catch {
    // SecureStore illisible : on retombe sur la déduction par le token
  }
  if (stored === "local" || stored === "account") mode = stored;
  else mode = hasToken ? "account" : null;
  return mode;
}

export async function setAppMode(next: AppMode): Promise<void> {
  mode = next;
  try {
    if (next) await SecureStore.setItemAsync(MODE_KEY, next);
    else await SecureStore.deleteItemAsync(MODE_KEY);
  } catch (e) {
    console.warn("[app-mode] enregistrement impossible", e);
  }
}

/**
 * Levée quand une fonction qui a besoin du serveur est appelée en mode local.
 * Ça ne doit jamais arriver dans l'app finie (les écrans concernés sont
 * masqués) : si on la voit, c'est un oubli à corriger, pas une panne.
 */
export class LocalModeUnavailableError extends Error {
  constructor(what: string) {
    super(`Indisponible sans compte (${what}).`);
    this.name = "LocalModeUnavailableError";
  }
}

/**
 * Garde à placer devant TOUT ce qui contacte le serveur BirthReminder :
 * c'est la promesse du mode local, « rien ne part ».
 */
export function assertAccountMode(what: string): void {
  if (mode === "local" && serverAccess === 0) {
    if (__DEV__) console.warn(`[app-mode] appel serveur bloqué : ${what}`);
    throw new LocalModeUnavailableError(what);
  }
}
