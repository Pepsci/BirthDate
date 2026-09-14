// constants/reactions.js
//
// Jeu de réactions disponibles sur un message.
//
// ⚠️ On stocke une CLÉ SÉMANTIQUE, jamais le caractère emoji.
//
// Un emoji est une donnée de présentation : son rendu varie d'une plateforme à
// l'autre, et le jour où l'on redessine le jeu d'icônes, une base remplie de
// « ❤️ » impose une migration. Une clé « love » survit à tous les changements
// de dessin, se traduit, et se compte proprement.
//
// L'ensemble est volontairement court. Six réactions couvrent l'essentiel de
// ce qu'on veut exprimer d'un geste ; au-delà, le sélecteur devient un menu et
// l'utilisateur hésite au lieu de réagir. C'est le choix de WhatsApp et de
// Messages, pour la même raison.
//
// `party` remplace le classique « prière » : sur une application d'anniversaire
// et d'événements, c'est la réaction la plus naturelle après le cœur.

const REACTIONS = ["like", "love", "laugh", "wow", "sad", "party"];

module.exports = { REACTIONS };
