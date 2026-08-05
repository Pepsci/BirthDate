# Audit des textes — CGU, politique de confidentialité, cookies, guide

*Août 2026 — écarts entre ce que fait le produit et ce que disent les textes.*

Je ne suis pas juriste : ce document liste des écarts factuels entre le code et
les textes publiés, pas un avis juridique. Les points 1 et 2 méritent une
relecture professionnelle avant mise en ligne.

---

## Critique

### 1. Les cagnottes ne figurent nulle part dans les CGU

C'est l'écart le plus grave. Le code fait circuler de l'argent entre
utilisateurs, par deux chemins bien distincts.

**Chemin A — Stripe, en charge directe.** `POST /:shortId/pool/contribute` crée
un PaymentIntent avec `{ stripeAccount: account.stripeAccountId }` et sans
`application_fee_amount` (la ligne est commentée). Autrement dit : **les fonds
vont directement sur le compte Stripe de l'organisateur, ne transitent jamais
par BirthReminder, et aucune commission n'est prélevée.** L'organisateur est le
commerçant au sens de Stripe ; c'est lui qui s'enrôle, fournit son identité et
subit les impayés. Cette architecture est la bonne, et elle protège le projet.

**Chemin B — IBAN.** Avec `giftPool.ibanEnabled`, l'organisateur dépose un RIB
(chiffré, `OrganizerBankInfo`, durée limitée) et les participants virent
l'argent de banque à banque. Ici, **aucune trace côté BirthReminder** : ni
montant, ni date, ni preuve de versement.

Les CGU ne disent rien de tout cela. Et c'est précisément le problème : sans
texte, rien n'établit que l'organisateur est le seul responsable. Un
participant lésé se retournera naturellement vers la plateforme qui a hébergé
la cagnotte. Ce qu'il faut écrire :

- BirthReminder n'est pas un établissement de paiement, ne détient jamais les
  fonds, ne perçoit aucune commission — c'est vrai, encore faut-il le dire
- l'organisateur est seul responsable de l'usage des sommes collectées, de leur
  restitution en cas d'annulation, et des éventuelles obligations fiscales
- les litiges se règlent entre participants et organisateur ; le remboursement
  d'un paiement Stripe relève du compte de l'organisateur
- la distinction entre les deux chemins, en avertissant que le mode IBAN ne
  laisse aucune trace exploitable en cas de conflit
- l'âge minimum pour organiser une cagnotte ou y contribuer

**Traçabilité en cas de conflit.** `GiftPoolContribution` enregistre le
contributeur, le montant, la devise, le message, l'horodatage, l'identifiant du
PaymentIntent et le statut confirmé par le webhook. On peut donc prouver qui a
payé quoi et quand — pour le chemin A uniquement. En revanche **rien ne trace
ce que l'organisateur fait de l'argent** une fois sur son compte Stripe : les
virements vers sa banque se jouent entre Stripe et lui. On peut établir la
collecte, pas le détournement.

Note : `CLAUDE.md` décrit encore la cagnotte comme un placeholder à ne pas
implémenter. Cette documentation est périmée et devrait être corrigée, sans
quoi la prochaine personne qui travaille sur le projet partira d'une fausse
idée.

### 1 bis. Le Premium annoncé n'existe pas

Sujet distinct de la cagnotte, à ne pas confondre. La section « 5. Abonnement
Premium (à venir) » décrit une offre à 2,99 €/mois, avec conditions de
paiement, résiliation et rétractation. Rien de tout cela n'est implémenté :
aucun abonnement, aucun prix, aucune facturation dans le code.

Annoncer contractuellement une offre payante inexistante n'apporte rien et
crée une attente. Soit on la retire des CGU jusqu'à son lancement, soit on la
reformule clairement comme un projet sans valeur contractuelle.

### 2. Les liens affiliés ne sont pas divulgués

`server/routes/wishlist.js` réécrit les URL Amazon en liens affiliés
(`processUrl` → `affiliateUrl`), renvoyés au client et utilisés à l'affichage.

Rien dans les CGU ni dans la politique ne le mentionne. Or :

- l'absence de divulgation d'un lien rémunéré est une pratique commerciale
  trompeuse au sens du code de la consommation
- le contrat Amazon Partenaires impose lui-même une mention visible

Il faut une phrase dans les CGU (« certains liens produits sont des liens
affiliés, nous percevons une commission sans surcoût pour vous ») et, si les
clics sont tracés, une ligne dans la politique de confidentialité.

---

## Important

### 3. Modération : dispositif absent des CGU

Le produit dispose d'un modèle `Report`, de routes `/api/moderation`, du
blocage d'utilisateurs et d'un back-office de traitement. Les CGU décrivent
des « comportements interdits » mais ne disent pas :

- qu'un utilisateur peut signaler un contenu ou une personne, et comment
- le délai de traitement d'un signalement et les suites possibles
- que le blocage empêche messages, demandes d'ami et invitations
- les sanctions encourues, et l'existence d'un recours en cas de suspension

C'est attendu par Apple (règle 1.2 sur le contenu généré par les
utilisateurs), et c'est aussi ce qui donne une base contractuelle pour
suspendre un compte.

### 4. Données des personnes non inscrites

La politique mentionne bien la collecte des « nom, prénom, date de naissance
des personnes que vous enregistrez ». Mais ces personnes ne sont pas
utilisatrices, n'ont rien accepté, et ne savent pas que leurs données sont
là. Depuis le partage de carte, elles peuvent en plus circuler vers un
troisième utilisateur.

Il manque une section dédiée : sur quelle base légale ces données sont
traitées, comment une personne concernée peut demander leur effacement sans
avoir de compte, et l'engagement de l'utilisateur à ne renseigner que des
proches. C'est le pendant de l'article 14 du RGPD.

### 5. Nouveautés de cette version absentes des CGU

La politique de confidentialité a été mise à jour (points 4.1 et 6), pas les
CGU. Il manque :

- le partage de carte : ce qui est transmis, ce qui ne l'est pas
  (les idées cadeaux), et le fait que la personne partagée doit accepter une
  demande d'ami
- le retrait d'une conversation : effet pour soi seul, conservation de la
  copie de l'autre, purge à 12 mois
- l'export de données, cité dans la politique mais pas dans les CGU

### 6. Politique cookies : l'enregistrement de session n'est pas annoncé

Rectification d'une première version de cet audit, qui affirmait à tort
qu'aucun outil de mesure n'était installé : **PostHog est bien en place**
(`front/src/analytics/analytics.js`), correctement conditionné au consentement
et hébergé dans l'Union européenne. La politique est exacte sur ce point.

Le manque est ailleurs, et il est plus sérieux :

- `session_recording` est activé. La navigation des utilisateurs peut donc
  être **rejouée**, ce qui va bien au-delà des « pages visitées, temps passé »
  annoncés. Les champs de saisie sont masqués, ce qui est une bonne pratique,
  mais l'enregistrement lui-même doit être annoncé.
- `autocapture` enregistre automatiquement les interactions.
- `identifyUser(userId)` rattache les mesures au compte connecté.
- La politique ne parle que du navigateur. L'app mobile stocke jeton, clé
  privée, thème et préférences dans le trousseau (`expo-secure-store`), ce qui
  n'est pas un cookie mais reste du stockage sur le terminal, à décrire.

---

## Guide d'utilisation

Le guide web (`GuidePage.jsx`) couvre : ajouter une date, amis, wishlist,
notifications, mon compte. Le guide mobile (`guide.tsx`) ajoute les
événements. Aucun des deux ne couvre :

| Fonctionnalité | Web | Mobile |
|---|---|---|
| Événements | absent | présent |
| Cagnotte | absent | absent |
| Liste de cadeaux commune | absent | absent |
| Partage d'une carte | absent | absent |
| Signalement et blocage | absent | absent |
| Chiffrement E2E et phrase de récupération | absent | absent |
| Retirer une conversation | absent | absent |
| Télécharger mes données | absent | absent |

Deux priorités : la **phrase de récupération E2E**, parce qu'un utilisateur
qui la perd perd l'accès à ses messages et que rien ne l'explique ; et la
**cagnotte**, parce qu'elle engage de l'argent.

À noter, le guide doit expliquer la différence entre les deux modes de
chiffrement, car elle change tout en cas de mot de passe oublié : en mode
standard la clé est chiffrée avec le mot de passe et les anciens messages sont
définitivement perdus, alors qu'en mode maximum la phrase de 12 mots permet de
redériver la même clé et de tout retrouver.

---

## Ordre de traitement suggéré

1. CGU — cagnottes et paiements (bloquant si les cagnottes sont ouvertes)
2. CGU — divulgation des liens affiliés (une phrase, effet immédiat)
3. Politique cookies — annoncer l'enregistrement de session
4. CGU — modération, signalement, blocage
5. Politique — section sur les personnes non inscrites
6. CGU — partage de carte, retrait de conversation, export
7. Guide — chiffrement E2E, puis cagnotte, puis le reste
8. `CLAUDE.md` — corriger la mention « cagnotte : ne pas implémenter »
