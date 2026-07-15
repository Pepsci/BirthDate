# Audit stores — BirthReminder mobile
*Juillet 2026 — préparation 1ʳᵉ soumission App Store & Play Store*

---

## ✅ Corrigé dans ce commit (rebuild EAS requis)

| Fichier | Correction | Pourquoi |
|---|---|---|
| `mobile/android/app/src/main/AndroidManifest.xml` | `RECORD_AUDIO` et `SYSTEM_ALERT_WINDOW` retirés du build release (`tools:node="remove"`), `READ/WRITE_EXTERNAL_STORAGE` scopées (`maxSdkVersion` 32/29) | Permissions inutilisées = signalement Play + incohérence Data safety. `SYSTEM_ALERT_WINDOW` est une permission sensible surveillée par Google. Le dev-client la garde via le manifest debug. |
| `mobile/app.json` | Plugin `expo-image-picker` ajouté : message photos en français, permissions caméra/micro non générées côté iOS | Apple 5.1.1 rejette les libellés de permission génériques/anglais ; l'app n'utilise que la galerie (photo de profil). |
| `mobile/app.json` | `ITSAppUsesNonExemptEncryption: false` | Évite la question export compliance à chaque upload TestFlight/App Store. Valide car le E2E utilise des algorithmes standards (X25519 / XSalsa20-Poly1305) → exempt. |

⚠️ Ces changements ne prennent effet qu'au prochain `eas build` (iOS : prebuild régénéré ; Android : manifest direct).

---

## 🔴 Bloquants restants avant soumission

### 1. Modération du contenu utilisateur (Apple 1.2 / Google UGC policy) — ✅ IMPLÉMENTÉ (15/07/2026)
Backend + mobile + web livrés :

- **Backend** : `Report` model, routes `/api/moderation` (signalement, block/unblock, liste admin), champ `User.blockedUsers`, filtrage des conversations et messages d'événements, alerte email à support@ à chaque signalement (à traiter sous 24 h — engagement à tenir opérationnellement !)
- **Mobile** : long-press sur un message (chat DM + chat événement) → Signaler ; menu ⋯ du chat → Signaler/Bloquer l'utilisateur ; Profil → Utilisateurs bloqués (déblocage) ; case CGU « tolérance zéro » à l'inscription
- **Web** : clic droit / appui long sur un message → Signaler ; bouton 🚫 dans l'en-tête du chat ; section Utilisateurs bloqués dans Profil → Confidentialité ; case CGU à l'inscription

Reste (mineur) : signalement des propositions de cadeaux/wishlists (les types sont déjà prévus dans l'API), filtrage temps réel des messages socket d'un utilisateur bloqué pendant la session en cours (le filtrage s'applique au rechargement), et **ajouter la clause « tolérance zéro » dans le texte des CGU web** (`front/src/components/pages/CGU.jsx`).

### 2. Page web publique de suppression de compte (Google, obligatoire depuis avril 2024)
La suppression in-app existe ✅ (conforme Apple 5.1.1(v)), mais le formulaire Data safety de Play Console exige **une URL web** accessible sans login (ex. `birthreminder.com/delete-account`) décrivant : ce qui est supprimé, ce qui est conservé et pourquoi, les délais. → tâche front web (hors périmètre mobile).

### 3. Âge minimum à l'inscription
La date de naissance est collectée mais aucun contrôle d'âge. RGPD France : consentement autonome à partir de **15 ans**. À faire : blocage < 15 ans dans `signup.tsx` + côté serveur, et déclaration cohérente dans les questionnaires d'âge des deux stores. *(Non appliqué : changement de comportement — à valider avant que je l'implémente.)*

---

## 🟠 Points de vigilance (risque modéré)

1. **Cagnotte Stripe** — conforme hors IAP (cadeaux physiques / transferts entre personnes, pas de contenu numérique débloqué). Prépare une **note de review** l'expliquant explicitement pour Apple, et remplis le formulaire **Financial features** dans Play Console. Vérifie que les CGU couvrent le service de cagnotte (Stripe = établissement de paiement, KYC via Connect).
2. **Déclaration cryptologie France** — fournir un moyen de cryptologie (E2E) en France implique en principe une déclaration ANSSI. À vérifier/faire une fois (formulaire simple). Côté US, l'auto-classification annuelle BIS est recommandée.
3. **NSE iOS** — `ios-nse/Info.plist` : `CFBundleShortVersionString` (1.0.0) doit rester synchronisée avec la version de l'app à chaque release (l'autoIncrement EAS ne touche pas ce plist) → sinon erreur ITMS à l'upload.
4. **`allowBackup="true"`** dans le manifest Android — recommandé `false` (les tokens/clés sont dans le Keystore, mais ça évite l'extraction du reste via backup). Changement de comportement → à valider.
5. **Compte de démo pour la review Apple** — obligatoire (app à login sans mode invité) : un compte pré-rempli avec amis, dates, un événement avec cagnotte test.
6. **Builds** — ne soumettre que le profil `production` d'`eas.json` (les profils dev/preview pointent vers HTTP local ou sont en distribution interne).

---

## ✅ Déjà conforme

- Suppression de compte in-app (Apple 5.1.1(v)) ✅
- Liens CGU + politique de confidentialité dans le profil ✅
- Pas de login social → **Sign in with Apple non requis** ✅
- Pas de SDK de tracking/analytics mobile → **pas d'ATT nécessaire** ✅ (si PostHog arrive sur mobile : config sans tracking cross-app, sinon prompt ATT obligatoire)
- Tokens en `expo-secure-store` (Keychain/Keystore), API en HTTPS en prod ✅
- **Target API 36** : requis pour toute nouvelle app dès le 31/08/2026 → Expo SDK 54 cible déjà API 36 ✅
- **Xcode 26 / iOS 26 SDK** : requis depuis le 28/04/2026 → EAS + SDK 54 utilise Xcode 26 ✅ (vérifier l'image de build EAS)
- Privacy manifests iOS : fournis par les modules Expo SDK 54 ✅
- Permission notifications demandée au runtime (POST_NOTIFICATIONS via expo-notifications) ✅

---

## 📋 Checklist fiches stores (hors code)

**App Store Connect**
- [ ] URL politique de confidentialité + URL support
- [ ] Labels de confidentialité : email, nom, date de naissance, photos, messages (E2E), infos de paiement (via Stripe) — liées à l'identité, **aucun tracking**
- [ ] Nouveau questionnaire de classification d'âge (obligatoire depuis 2026)
- [ ] Note de review : cagnotte (biens physiques, hors IAP) + E2E + compte de démo
- [ ] Screenshots 6.9"/6.5", icône 1024 px

**Play Console**
- [ ] Data safety (mêmes données) + **URL de suppression de compte** (bloquant n° 2)
- [ ] Formulaire Financial features (cagnotte via Stripe)
- [ ] Questionnaire de classification du contenu
- [ ] Screenshots téléphone + bannière 1024×500

---

## Ordre suggéré

1. Modération UGC (le plus gros chantier — backend + mobile + web)
2. Page web `/delete-account` + contrôle d'âge signup
3. Rebuild EAS production (corrections de ce commit incluses)
4. Fiches stores + compte de démo + note de review
5. Déclaration ANSSI (parallélisable)
