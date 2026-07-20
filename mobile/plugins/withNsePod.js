/**
 * withNsePod.js — Config plugin Expo
 *
 * Ajoute au Podfile généré par prebuild la dépendance crypto de la cible NSE
 * (swift-sodium : mêmes primitives que tweetnacl côté JS — crypto_box
 * X25519 + XSalsa20-Poly1305).
 *
 * La cible 'BirthReminderNSE' elle-même est créée par @bacons/apple-targets
 * (voir targets/BirthReminderNSE/expo-target.config.js).
 *
 * Usage dans app.json : "plugins": [ ..., "./plugins/withNsePod" ]
 */

const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const POD_BLOCK = `
# Dépendance crypto de la Notification Service Extension (ajouté par withNsePod)
# ⚠️ Pas de use_frameworks! ici : l'app hôte est en bibliothèques statiques et
# CocoaPods exige que l'hôte et l'extension embarquée utilisent le même mode
# ("do not both set use_frameworks!"). Sodium se compile en statique sans souci.
target 'BirthReminderNSE' do
  pod 'Sodium', '~> 0.9'
end
`;

// withNsePod:link-sodium — le flag -lsodium est bien propagé par CocoaPods à la
// cible NSE, mais pendant un `xcodebuild archive` le chemin de recherche
// ${PODS_XCFRAMEWORKS_BUILD_DIR}/Clibsodium pointe vers un dossier inexistant
// (BuildProductsPath/... au lieu du dossier où le script "[CP] Copy
// XCFrameworks" copie la slice) → "Undefined symbols: _crypto_*".
// Fix : ajouter en LIBRARY_SEARCH_PATHS le chemin direct de la slice dans
// Pods/, par SDK (device / simulateur). Injecté dans le post_install existant
// du Podfile Expo (un Podfile n'accepte qu'un seul post_install).
const LINK_FIX = [
  "",
  "    # withNsePod:link-sodium — libsodium.a passé directement en entrée du linker",
  "    nse_fix_count = 0",
  "    xcfw = 'Sodium/Clibsodium.xcframework'",
  "    device_lib = %Q(\"$(PODS_ROOT)/#{xcfw}/ios-arm64_armv7_armv7s/libsodium.a\")",
  "    sim_lib = %Q(\"$(PODS_ROOT)/#{xcfw}/ios-arm64_i386_x86_64-simulator/libsodium.a\")",
  "    installer.aggregate_targets.each do |agg|",
  "      next unless agg.name == 'Pods-BirthReminderNSE'",
  "      raise 'withNsePod: xcframework Clibsodium introuvable dans Pods/' unless File.directory?(File.join(installer.sandbox.root.to_s, xcfw))",
  "      agg.user_targets.each do |t|",
  "        next unless t.name == 'BirthReminderNSE'",
  "        t.build_configurations.each do |bc|",
  "          bc.build_settings['OTHER_LDFLAGS[sdk=iphoneos*]'] = ['$(inherited)', device_lib]",
  "          bc.build_settings['OTHER_LDFLAGS[sdk=iphonesimulator*]'] = ['$(inherited)', sim_lib]",
  "          nse_fix_count += 1",
  "        end",
  "      end",
  "      agg.user_project.save",
  "    end",
  "    raise 'withNsePod: cible BirthReminderNSE introuvable — fix libsodium non appliqué' if nse_fix_count.zero?",
  "    Pod::UI.puts \"[withNsePod] libsodium lié en direct sur #{nse_fix_count} configuration(s) NSE\"",
  "",
].join("\n");

// withNsePod:strip-lsodium — retire le -l"sodium" généré par CocoaPods des
// xcconfigs de la cible NSE : sur APFS insensible à la casse, -lsodium résout
// vers libSodium.a (le wrapper Swift !) au lieu de la lib C → wrapper linké 2x
// = 531 duplicate symbols. La lib C est fournie en direct via OTHER_LDFLAGS
// (cf. LINK_FIX), ce flag est donc inutile ET nuisible. Fait en post_integrate
// (et pas post_install) car CocoaPods réécrit les xcconfigs après post_install.
const STRIP_LSODIUM = `
# withNsePod:strip-lsodium (voir plugins/withNsePod.js)
post_integrate do |installer|
  files = Dir.glob(File.join(installer.sandbox.root.to_s, 'Target Support Files', 'Pods-BirthReminderNSE', '*.xcconfig'))
  raise 'withNsePod: xcconfigs Pods-BirthReminderNSE introuvables en post_integrate' if files.empty?
  count = 0
  files.each do |f|
    txt = File.read(f)
    patched = txt.gsub(/[ \\t]*-l"sodium"/, '')
    if patched != txt
      File.write(f, patched)
      count += 1
    end
  end
  Pod::UI.puts "[withNsePod] -l\\"sodium\\" retiré de #{count} xcconfig(s) NSE (post_integrate)"
end
`;

module.exports = function withNsePod(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile",
      );
      let contents = fs.readFileSync(podfilePath, "utf8");
      let changed = false;
      if (!contents.includes("target 'BirthReminderNSE'")) {
        contents += POD_BLOCK;
        changed = true;
      }
      if (!contents.includes("withNsePod:link-sodium")) {
        const anchor = /post_install do \|installer\|/;
        if (anchor.test(contents)) {
          contents = contents.replace(anchor, (m) => m + LINK_FIX);
          changed = true;
        } else {
          throw new Error(
            "withNsePod : bloc post_install introuvable dans le Podfile — impossible d'injecter le fix de link libsodium.",
          );
        }
      }
      if (!contents.includes("withNsePod:strip-lsodium")) {
        contents += STRIP_LSODIUM;
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
};
