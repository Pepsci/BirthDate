/**
 * Garde "écran de bienvenue" — en mémoire uniquement : se réinitialise
 * à chaque lancement de l'app (le welcome s'affiche donc à chaque démarrage).
 *
 * markWelcomeSeen() est aussi appelé par les handlers de notifications
 * (deep links) pour ne pas détourner la navigation vers /welcome.
 */
let seen = false;

export function hasSeenWelcome(): boolean {
  return seen;
}

export function markWelcomeSeen(): void {
  seen = true;
}
