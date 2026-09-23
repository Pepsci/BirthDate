# Google Play — fiche Store et Sécurité des données

*Rédigé le 23 septembre 2026. À relire avant chaque envoi : les réponses
« Sécurité des données » doivent rester vraies.*

Nom du package : `com.birthreminder.app`

---

## 1. Fiche Play Store

### Nom de l'application (30 caractères max)

```
BirthReminder
```

### Description courte (80 caractères max)

```
N'oubliez plus aucun anniversaire. Idées cadeaux, événements et cagnotte commune.
```

(80 caractères pile.)

### Description longue (4 000 caractères max)

```
Ne plus jamais oublier un anniversaire, et organiser la fête sans y passer des heures.

BirthReminder réunit au même endroit les dates de vos proches, les idées cadeaux et l'organisation de vos événements.

━━━━━━━━━━━━━━━━━━━━

🎂 LES ANNIVERSAIRES, JAMAIS OUBLIÉS

Enregistrez les dates de vos proches et recevez un rappel 30, 14, 7 ou 1 jour avant, comme vous préférez. Les fêtes (prénoms) sont gérées aussi, et l'agenda vous montre le mois ou la semaine d'un coup d'œil.

🎁 DES IDÉES CADEAUX QUI NE SE PERDENT PLUS

Notez vos idées au fil de l'année sur la fiche de chaque personne. Créez votre wishlist et partagez-la : vos proches voient ce qui vous ferait plaisir et réservent un cadeau, sans que vous sachiez lequel.

👥 DES LISTES DE CADEAUX COMMUNES

Vous offrez à plusieurs ? Partagez une liste entre offrants. Chacun réserve ce dont il s'occupe, personne n'achète deux fois la même chose, et la personne concernée n'en voit rien.

🎉 DES ÉVÉNEMENTS ORGANISÉS À PLUSIEURS

Créez un anniversaire, un repas ou une fête. Faites voter la date et le lieu, suivez les réponses, discutez dans le chat de groupe. Vos invités peuvent participer même sans compte, avec un simple lien et un code.

💳 UNE CAGNOTTE COMMUNE, SANS COMMISSION

Collectez la participation de chacun pour un cadeau commun. Le paiement est sécurisé par Stripe, l'argent arrive directement sur le compte de l'organisateur, et BirthReminder ne prélève aucune commission. Chaque participant reçoit un reçu par email.

🔒 VOS MESSAGES SONT CHIFFRÉS DE BOUT EN BOUT

Les messages privés sont chiffrés sur votre téléphone et déchiffrés sur celui de votre destinataire. Personne d'autre ne peut les lire, pas même nous.

━━━━━━━━━━━━━━━━━━━━

✔ Gratuit, sans publicité
✔ Aucune commission sur les cagnottes
✔ Application française, données hébergées en Europe
✔ Disponible aussi sur le web et sur iPhone : vos données vous suivent

━━━━━━━━━━━━━━━━━━━━

Des questions ou une remarque ? Écrivez-nous depuis l'application (Profil > Aide) ou sur birthreminder.com.
```

### Catégorie

- Catégorie : **Style de vie** (alternative : Réseaux sociaux)
- Tags : anniversaire, rappel, cadeau, événement, wishlist

### Coordonnées

- Email : contact@birthreminder.com
- Site web : https://birthreminder.com
- Règles de confidentialité : https://birthreminder.com/privacy

### Éléments graphiques à fournir

| Élément | Format |
|---|---|
| Icône | 512 × 512 px, PNG 32 bits |
| Image de présentation | 1024 × 500 px |
| Captures téléphone | 2 à 8, min. 320 px, max. 3840 px |
| Captures tablette (facultatif) | 7 et 10 pouces |

Captures conseillées : agenda, fiche d'une personne avec ses idées cadeaux,
page d'un événement, cagnotte, discussion chiffrée.

---

## 2. Sécurité des données — réponses

⚠️ Ces réponses décrivent l'APPLICATION ANDROID. Le suivi d'audience
(`front/src/analytics`) est propre au site web et ne concerne pas ce
formulaire.

### Questions générales

| Question | Réponse |
|---|---|
| Votre app collecte-t-elle des données utilisateur ? | **Oui** |
| Données chiffrées en transit ? | **Oui** (HTTPS ; messages chiffrés de bout en bout en plus) |
| L'utilisateur peut-il demander la suppression de ses données ? | **Oui** |
| Données partagées avec des tiers ? | **Non**, hors prestataires techniques (voir note Stripe) |

### Données collectées

| Type | Collecté | Partagé | Obligatoire | Finalité |
|---|---|---|---|---|
| Nom | Oui, associé | Non | Obligatoire | Fonctionnalité de l'app |
| Adresse e-mail | Oui, associé | Non | Obligatoire | Fonctionnalité, gestion du compte |
| Autres infos personnelles (date de naissance) | Oui, associé | Non | Obligatoire | Fonctionnalité (rappels, contrôle d'âge) |
| ID utilisateur | Oui, associé | Non | Obligatoire | Fonctionnalité |
| Photos | Oui, associé | Non | Facultatif | Photo de profil, photo d'une fiche |
| Messages dans l'app | Oui, associé | Non | Facultatif | Fonctionnalité (chiffrés de bout en bout) |
| Autres contenus créés | Oui, associé | Non | Facultatif | Wishlists, idées cadeaux, événements |
| Historique d'achats | Oui, associé | Non | Facultatif | Participations aux cagnottes |
| ID d'appareil | Oui, associé | Non | Facultatif | Jeton de notification push |

### Points à trancher avant de valider

1. **Stripe.** Les coordonnées bancaires sont saisies dans le module Stripe et
   ne transitent jamais par nos serveurs. Déclarer « Informations de paiement »
   comme collectées par un prestataire, non stockées. En cas de doute, cocher
   « Informations financières > Informations de paiement » en précisant
   qu'elles sont traitées par le prestataire de paiement.
2. **Adresse IP.** Le serveur journalise l'IP à des fins de sécurité et de
   lutte contre la fraude (`log.model.js`). Si l'IP est conservée au-delà du
   traitement immédiat, la déclarer.
3. **Aucune position géographique** n'est collectée : les lieux d'événements
   sont saisis à la main, l'app ne demande jamais la localisation de
   l'appareil.

### Suppression du compte

Google exige une page web accessible SANS installer l'app, qui explique
comment demander la suppression et ce qui est supprimé.
`https://birthreminder.com/privacy` en parle, mais il n'existe pas de page
dédiée : en créer une (par exemple `/suppression-compte`) avant l'envoi.
