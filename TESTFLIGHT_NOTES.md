# Notes TestFlight — à tester

Nouvelle version. Cinq nouveautés à passer en revue. Merci de signaler tout ce
qui bloque, même mineur.

## 1. Statistiques de l'accueil

L'encart de chiffres en page d'accueil affichait les totaux de toute la
communauté, mais plusieurs d'entre vous les lisaient comme leurs propres
chiffres. Les libellés sont maintenant explicites : "anniversaires souhaités
aujourd'hui" pour la communauté.

Nouveau réglage : Profil, Réglages, "Afficher mes statistiques". Une fois
activé, l'encart bascule sur vos propres chiffres, avec les prénoms des
personnes concernées sous le total.

À vérifier : que le titre de la section change bien, que les chiffres
correspondent à vos dates, et que le réglage tient après un redémarrage de
l'app.

## 2. Fête modifiable

Il était impossible de corriger la fête d'une carte depuis le téléphone. Le
champ existe maintenant à l'ajout comme à la modification d'une date, sous
forme de sélecteur mois puis jour.

Si vous n'y touchez pas, la fête reste détectée automatiquement depuis le
prénom, comme avant. Vous pouvez aussi la retirer complètement.

À vérifier : la fête choisie s'affiche bien sur la carte et dans l'agenda.

## 3. Partage d'une carte

Nouveau bouton "Partager cette carte" sur la fiche d'une personne. Vous
choisissez un ami, il reçoit la carte dans votre conversation.

Selon le cas, il aura une ou deux options :

- si la personne partagée a un compte, il peut lui envoyer une demande d'ami.
  Elle doit accepter ; si elle accepte, la carte se crée automatiquement des
  deux côtés
- dans tous les cas, il peut simplement créer la carte chez lui

Vos idées cadeaux ne sont jamais transmises. Si la personne existe déjà dans
ses anniversaires, l'app le lui dit au lieu de créer un doublon.

À vérifier : le partage depuis une carte manuelle et depuis une carte d'ami
inscrit, et la réception côté destinataire.

## 4. Retirer une conversation de sa liste

Appui long sur une conversation dans l'onglet Messages. Le retrait ne vaut que
pour vous : votre correspondant garde son historique. C'est volontaire, un
utilisateur ne doit pas pouvoir effacer des messages chez quelqu'un d'autre,
en particulier s'ils servent de preuve après un signalement.

Si un nouveau message arrive ensuite, la conversation réapparaît, avec les
nouveaux messages uniquement.

À vérifier : la conversation disparaît immédiatement de la liste, et l'ancien
historique ne revient pas quand elle réapparaît.

## 6. Télécharger mes données

Profil, puis "Télécharger mes données". Vous obtenez un fichier JSON contenant
votre profil, vos dates, vos amis, vos cadeaux, vos événements, vos
conversations et votre journal d'activité.

Vos messages sont chiffrés de bout en bout : nos serveurs ne peuvent pas les
lire. Ils sont déchiffrés sur votre appareil au moment de l'export. Si vous
lancez l'export depuis un appareil où votre clé n'a pas été restaurée, les
messages concernés apparaîtront comme non déchiffrables, ce qui est le
comportement attendu.

À vérifier : le fichier se génère, la fenêtre de partage s'ouvre, et les
messages y sont bien lisibles.

## 7. Deux corrections signalées par vous

Wishlist : le champ "URL de l'image" manquait sur mobile alors qu'il existait
sur le site. Vous pouvez maintenant coller un lien d'image à la main, en plus
du bouton "Remplir" qui la récupère automatiquement quand le site le permet.

Changement de mot de passe : un bouton "Afficher" révèle ce que vous tapez
dans les trois champs, pour éviter les fautes de frappe invisibles.

## 5. Blocage renforcé

Bloquer quelqu'un masquait la conversation, mais la personne bloquée pouvait
continuer à écrire sans le savoir. Le blocage empêche désormais les messages,
les demandes d'ami et les invitations à un événement ou à une liste commune.

À vérifier, idéalement à deux comptes : après un blocage, aucun message ni
aucune demande ne doit arriver.
