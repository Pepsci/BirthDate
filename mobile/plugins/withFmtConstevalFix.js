const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Désactive `consteval` dans la bibliothèque fmt compilée par les Pods.
 *
 * ⚠️ Pourquoi ce correctif existe. Apple Clang 21 (Xcode 26.4) applique les
 * règles C++20 sur `consteval` plus strictement que les versions précédentes.
 * fmt 11.0.2 — la version épinglée par React Native 0.81 — ne compile plus :
 * chaque `FMT_STRING` déclenche « Call to consteval function
 * fmt::basic_format_string<…> » dans format-inl.h. Le code de l'application
 * n'y est pour rien : c'est une dépendance native de React Native.
 *
 * Le correctif remplace `FMT_USE_CONSTEVAL 1` par `0` dans `fmt/base.h`. fmt
 * bascule alors ses vérifications de chaînes de format de la compilation vers
 * l'exécution. Ça ne change pas le binaire produit ni le comportement de
 * l'application : seul React Native utilise fmt ici, avec des chaînes fixes
 * qui étaient déjà valides.
 *
 * Posé dans un `post_install` : c'est le seul moment où les sources des Pods
 * sont sur le disque. Et posé dans un plugin plutôt que dans le Podfile, car
 * `ios/` est ignoré par git et régénéré à chaque `expo prebuild` — un Podfile
 * modifié à la main serait perdu au prochain build de quelqu'un d'autre, ou
 * du prochain toi.
 *
 * ⚠️ À SUPPRIMER après le passage à React Native ≥ 0.83.9 / Expo SDK 56, qui
 * embarquent fmt 12.1.0, corrigé en amont. Le bloc ne fait rien de dangereux
 * s'il reste, mais il masquerait une vraie erreur de format le jour où le
 * projet utilisera fmt directement.
 */
const FMT_FIX = `
    # withFmtConstevalFix — voir plugins/withFmtConstevalFix.js
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      src = File.read(fmt_base)
      if src.include?('#  define FMT_USE_CONSTEVAL 1')
        File.write(fmt_base, src.gsub('#  define FMT_USE_CONSTEVAL 1', '#  define FMT_USE_CONSTEVAL 0'))
        Pod::UI.puts '[withFmtConstevalFix] FMT_USE_CONSTEVAL desactive (Apple Clang 21)'
      end
    else
      Pod::UI.warn "[withFmtConstevalFix] fmt/base.h introuvable : correctif non applique"
    end
`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile",
      );
      let contents = fs.readFileSync(podfilePath, "utf8");

      if (contents.includes("withFmtConstevalFix")) return cfg;

      // Un Podfile n'accepte qu'un seul `post_install` : on s'injecte dans
      // celui d'Expo, comme le fait déjà withNsePod.
      const anchor = /post_install do \|installer\|/;
      if (!anchor.test(contents)) {
        throw new Error(
          "withFmtConstevalFix : bloc post_install introuvable dans le Podfile.",
        );
      }
      contents = contents.replace(anchor, (m) => m + FMT_FIX);
      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
