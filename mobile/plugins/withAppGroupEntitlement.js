/**
 * withAppGroupEntitlement.js — Config plugin Expo
 *
 * Ajoute à l'APP PRINCIPALE (pas l'extension) :
 *   - l'App Group `group.com.birthreminder.app`
 *   - le keychain-access-group correspondant
 *
 * Nécessaire pour que la clé privée E2E écrite par expo-secure-store soit
 * lisible par la Notification Service Extension (déchiffrement des notifs iOS).
 *
 * ⚠️ Ce plugin ne crée PAS la cible NSE elle-même (injection de target Xcode).
 * Pour ça, voir ios-nse/README.md (option Xcode manuelle ou @bacons/apple-targets).
 *
 * Usage dans app.json :
 *   "plugins": [ ..., "./plugins/withAppGroupEntitlement" ]
 */

const { withEntitlementsPlist } = require("expo/config-plugins");

const APP_GROUP = "group.com.birthreminder.app";

module.exports = function withAppGroupEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    const ent = cfg.modResults;

    // App Groups
    const groups = ent["com.apple.security.application-groups"] || [];
    if (!groups.includes(APP_GROUP)) groups.push(APP_GROUP);
    ent["com.apple.security.application-groups"] = groups;

    // Keychain sharing (préfixe AppIdentifierPrefix ajouté par Xcode au build)
    const keychainGroups = ent["keychain-access-groups"] || [];
    const kc = `$(AppIdentifierPrefix)${APP_GROUP}`;
    if (!keychainGroups.includes(kc)) keychainGroups.push(kc);
    ent["keychain-access-groups"] = keychainGroups;

    return cfg;
  });
};
