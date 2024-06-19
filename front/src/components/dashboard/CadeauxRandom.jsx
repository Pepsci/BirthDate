// randomImage.js
import cadeau1 from "./cadeaux/cadeau (1).png";
import cadeau2 from "./cadeaux/cadeau (2).png";
import cadeau3 from "./cadeaux/cadeau (3).png";
import cadeau4 from "./cadeaux/cadeau (4).png";
import cadeau5 from "./cadeaux/cadeau (5).png";
import cadeau6 from "./cadeaux/cadeau (6).png";
import cadeau7 from "./cadeaux/cadeau (7).png";
import cadeau8 from "./cadeaux/cadeau (8).png";
import cadeau9 from "./cadeaux/cadeau (9).png";
import cadeau10 from "./cadeaux/cadeau (10).png";
import cadeau11 from "./cadeaux/cadeau (11).png";
import cadeau12 from "./cadeaux/cadeau (12).png";
import cadeau13 from "./cadeaux/cadeau (13).png";
import cadeau14 from "./cadeaux/cadeau (14).png";
import cadeau15 from "./cadeaux/cadeau (15).png";
import cadeau16 from "./cadeaux/cadeau (16).png";
import cadeau17 from "./cadeaux/cadeau (17).png";
import cadeau18 from "./cadeaux/cadeau (18).png";
import cadeau19 from "./cadeaux/cadeau (19).png";
import cadeau20 from "./cadeaux/cadeau (20).png";
import cadeau21 from "./cadeaux/cadeau (21).png";
import cadeau22 from "./cadeaux/cadeau (22).png";
import cadeau23 from "./cadeaux/cadeau (23).png";
import cadeau24 from "./cadeaux/cadeau (24).png";
import cadeau25 from "./cadeaux/cadeau (25).png";
import cadeau26 from "./cadeaux/cadeau (26).png";
import cadeau27 from "./cadeaux/cadeau (27).png";
import cadeau28 from "./cadeaux/cadeau (28).png";
import cadeau29 from "./cadeaux/cadeau (29).png";
import cadeau30 from "./cadeaux/cadeau (30).png";
import cadeau31 from "./cadeaux/cadeau (31).png";
import cadeau32 from "./cadeaux/cadeau (32).png";
// import cadeau33 from "./cadeaux/cadeau (33).png";
import cadeau34 from "./cadeaux/cadeau (34).png";

// Stockez les images dans un tableau
const images = [
  cadeau1,
  cadeau2,
  cadeau3,
  cadeau4,
  cadeau5,
  cadeau6,
  cadeau7,
  cadeau8,
  cadeau9,
  cadeau10,
  cadeau11,
  cadeau12,
  cadeau13,
  cadeau14,
  cadeau15,
  cadeau16,
  cadeau17,
  cadeau18,
  cadeau19,
  cadeau20,
  cadeau21,
  cadeau22,
  cadeau23,
  cadeau24,
  cadeau25,
  cadeau26,
  cadeau27,
  cadeau28,
  cadeau29,
  cadeau30,
  cadeau31,
  cadeau32,
  cadeau34,
];

// Fonction pour obtenir une image aléatoire
export const getRandomImage = () => {
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
};
