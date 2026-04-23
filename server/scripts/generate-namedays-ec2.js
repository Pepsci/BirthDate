#!/usr/bin/env node

/**
 * generate-namedays-ec2.js
 * À lancer sur ton EC2 : node generate-namedays-ec2.js
 *
 * Appelle l'API abalin.net pour les 366 jours,
 * merge avec les données existantes hardcodées,
 * puis affiche les deux JSON dans le terminal.
 */

const https = require('https');

// ─────────────────────────────────────────────
// BASE déjà construite (fallback si API fails)
// ─────────────────────────────────────────────
const base = {
  "01-01":["Marie","Sainte-Marie"],"01-02":["Basile","Grégoire"],"01-03":["Geneviève"],"01-04":["Odilon","Pharaïlde"],"01-05":["Édouard","Simone"],"01-06":["Melchior","Gaspard","Balthazar"],"01-07":["Raymond","Lucien","Virginie"],"01-08":["Lucien","Gudule","Nathan"],"01-09":["Alix"],"01-10":["Guillaume"],"01-11":["Paulin"],"01-12":["Tatiana"],"01-13":["Yvette","Hilaire"],"01-14":["Nina"],"01-15":["Rémi"],"01-16":["Marcel"],"01-17":["Roseline","Antoine"],"01-18":["Prisca"],"01-19":["Marius","Martha"],"01-20":["Sébastien","Fabien"],"01-21":["Agnès"],"01-22":["Vincent","Anastase"],"01-23":["Barnard","Émerentiane"],"01-24":["François de Sales"],"01-25":["Conversion de Paul"],"01-26":["Timothée","Tite","Mélanie","Stéphanie"],"01-27":["Angèle"],"01-28":["Thomas d'Aquin"],"01-29":["Gildas"],"01-30":["Martine","Bathilde","Pauline"],"01-31":["Marcelle","Jean Bosco"],
  "02-01":["Ella","Brigitte"],"02-02":["Chandeleur"],"02-03":["Blaise","Oscar"],"02-04":["Véronique"],"02-05":["Agathe"],"02-06":["Gaston"],"02-07":["Eugénie"],"02-08":["Jacqueline"],"02-09":["Apolline"],"02-10":["Arnaud","Scholastique"],"02-11":["Lourdes","Théodore"],"02-12":["Félix"],"02-13":["Béatrice"],"02-14":["Valentin"],"02-15":["Claude"],"02-16":["Julienne"],"02-17":["Alexis"],"02-18":["Bernadette"],"02-19":["Gabin"],"02-20":["Aimée"],"02-21":["Damien","Noël"],"02-22":["Isabelle"],"02-23":["Lazare"],"02-24":["Modeste"],"02-25":["Roméo"],"02-26":["Nestor"],"02-27":["Honorine"],"02-28":["Romain"],"02-29":["Auguste"],
  "03-01":["Aubin"],"03-02":["Charles le Bon"],"03-03":["Guénolé"],"03-04":["Casimir"],"03-05":["Chloé","Olive"],"03-06":["Colette"],"03-07":["Félicité","Perpétue"],"03-08":["Jean de Dieu","Véronique"],"03-09":["Françoise"],"03-10":["Vivien"],"03-11":["Rosine"],"03-12":["Justine"],"03-13":["Rodrigue"],"03-14":["Mathilde"],"03-15":["Louise","Clément"],"03-16":["Bénédicte"],"03-17":["Patrick"],"03-18":["Cyril"],"03-19":["Joseph"],"03-20":["Herbert"],"03-21":["Clémence"],"03-22":["Léa"],"03-23":["Victorien"],"03-24":["Catelan"],"03-25":["Annonciation"],"03-26":["Larissa"],"03-27":["Habib"],"03-28":["Gontran"],"03-29":["Gwladys"],"03-30":["Amédée"],"03-31":["Benjamin","Bénigne"],
  "04-01":["Hugues","Cédric"],"04-02":["Sandrine","François de Paule"],"04-03":["Richard"],"04-04":["Isidore"],"04-05":["Irène"],"04-06":["Marcellin"],"04-07":["Jean-Baptiste de la Salle"],"04-08":["Julie","Julia","Juliette"],"04-09":["Gautier"],"04-10":["Fulbert"],"04-11":["Stanislas"],"04-12":["Jules"],"04-13":["Ida"],"04-14":["Maxime"],"04-15":["Paterne","Clémence"],"04-16":["Benoît-Joseph"],"04-17":["Anicet"],"04-18":["Parfait"],"04-19":["Emma"],"04-20":["Odette","Odile"],"04-21":["Anselme"],"04-22":["Alexandre"],"04-23":["Georges"],"04-24":["Fidèle"],"04-25":["Marc"],"04-26":["Alida","Richilde"],"04-27":["Zita"],"04-28":["Valérie","Prudence","Élodie"],"04-29":["Catherine de Sienne"],"04-30":["Robert"],
  "05-01":["Fête du Travail","Joseph Ouvrier"],"05-02":["Boris"],"05-03":["Philippe","Jacques"],"05-04":["Sylvain","Florian"],"05-05":["Judith"],"05-06":["Prudence"],"05-07":["Gisèle"],"05-08":["Victoire"],"05-09":["Pacôme"],"05-10":["Solange"],"05-11":["Estelle","Mamert"],"05-12":["Achille"],"05-13":["Rolande"],"05-14":["Matthias"],"05-15":["Denise","Isidore","Virginie"],"05-16":["Honoré"],"05-17":["Pascal"],"05-18":["Éric","Eric"],"05-19":["Yves","Yvon"],"05-20":["Bernardin"],"05-21":["Constantin"],"05-22":["Rita"],"05-23":["Didier"],"05-24":["Donatien"],"05-25":["Sophie"],"05-26":["Bérenger"],"05-27":["Augustin de Canterbury"],"05-28":["Germain"],"05-29":["Aymar"],"05-30":["Ferdinand"],"05-31":["Visitation"],
  "06-01":["Justin"],"06-02":["Blandine"],"06-03":["Kévin","Kevin","Charles Lwanga"],"06-04":["Clotilde"],"06-05":["Igor"],"06-06":["Norbert","Hugo"],"06-07":["Gilbert","Adrien"],"06-08":["Médard"],"06-09":["Diane","Félicien"],"06-10":["Landry","Laura"],"06-11":["Barnabé"],"06-12":["Guy"],"06-13":["Antoine de Padoue","Baptiste"],"06-14":["Élisée"],"06-15":["Germaine"],"06-16":["Jean-François Régis"],"06-17":["Hervé","Rainier"],"06-18":["Léonce"],"06-19":["Romuald"],"06-20":["Silvère","Léon","Léo"],"06-21":["Rodolphe"],"06-22":["Alban","Thomas More"],"06-23":["Audrey"],"06-24":["Jean-Baptiste","Nativité","Jean","Arthur"],"06-25":["Prosper"],"06-26":["Anthelme"],"06-27":["Fernand"],"06-28":["Irénée"],"06-29":["Pierre","Paul"],"06-30":["Martial"],
  "07-01":["Thierry"],"07-02":["Martinien"],"07-03":["Thomas"],"07-04":["Florent"],"07-05":["Antoine","Enzo"],"07-06":["Mariette","Maria Goretti"],"07-07":["Raoul"],"07-08":["Thibaut","Théo"],"07-09":["Amandine"],"07-10":["Ulrich"],"07-11":["Benoît","Benoit"],"07-12":["Olivier"],"07-13":["Joël","Henri","Sara"],"07-14":["Fête Nationale"],"07-15":["Donald","Bonaventure"],"07-16":["Notre-Dame du Carmel"],"07-17":["Charlotte"],"07-18":["Frédéric","Camille"],"07-19":["Arsène"],"07-20":["Marina","Marguerite","Margot"],"07-21":["Victor"],"07-22":["Marie-Madeleine","Madeleine","Magalie","Maëlle"],"07-23":["Brigitte de Suède"],"07-24":["Christine","Christelle"],"07-25":["Jacques","Christophe","Lucas"],"07-26":["Anne","Annie","Joachim"],"07-27":["Nathalie"],"07-28":["Samson"],"07-29":["Marthe"],"07-30":["Juliette"],"07-31":["Ignace de Loyola"],
  "08-01":["Alphonse"],"08-02":["Julien Eymard"],"08-03":["Lydie"],"08-04":["Jean-Marie Vianney"],"08-05":["Abel"],"08-06":["Transfiguration"],"08-07":["Gaétan"],"08-08":["Dominique"],"08-09":["Amour","Sarah"],"08-10":["Laurent"],"08-11":["Claire","Clara"],"08-12":["Clarisse"],"08-13":["Hippolyte"],"08-14":["Eusèbe"],"08-15":["Assomption","Marie","Marion","Manon","Marianne","Maria","Mariam"],"08-16":["Armel"],"08-17":["Hyacinthe"],"08-18":["Hélène"],"08-19":["Jean-Eudes"],"08-20":["Bernard"],"08-21":["Christophe"],"08-22":["Fabrice","Margot"],"08-23":["Rose de Lima"],"08-24":["Barthélemy"],"08-25":["Louis","Patricia","Louise"],"08-26":["Natacha"],"08-27":["Monique","Monica"],"08-28":["Augustin"],"08-29":["Sabine"],"08-30":["Fiacre"],"08-31":["Aristide"],
  "09-01":["Gilles"],"09-02":["Ingrid"],"09-03":["Grégoire le Grand"],"09-04":["Rosalie","Rosa"],"09-05":["Raïssa"],"09-06":["Bertrand"],"09-07":["Reine"],"09-08":["Nativité de la Vierge","Adrienne","Anaïs"],"09-09":["Alain"],"09-10":["Inès"],"09-11":["Adelphe"],"09-12":["Apollinaire"],"09-13":["Aimé"],"09-14":["Exaltation de la Croix"],"09-15":["Roland"],"09-16":["Édith","Corneille"],"09-17":["Renaud","Stéphane"],"09-18":["Nadège","Nadia"],"09-19":["Émilie"],"09-20":["Davy"],"09-21":["Matthieu","Mathieu"],"09-22":["Maurice"],"09-23":["Constance","Nadine"],"09-24":["Thècle"],"09-25":["Hermann"],"09-26":["Côme","Damien"],"09-27":["Vincent de Paul"],"09-28":["Venceslas"],"09-29":["Michel","Gabriel","Raphaël","Michaël"],"09-30":["Jérôme"],
  "10-01":["Thérèse de l'Enfant-Jésus","Thérèse"],"10-02":["Léger","Anges gardiens"],"10-03":["Gérard"],"10-04":["François d'Assise","François"],"10-05":["Fleur"],"10-06":["Bruno"],"10-07":["Rosaire"],"10-08":["Pélagie"],"10-09":["Denis","Ghislain"],"10-10":["Ghislain"],"10-11":["Firmin"],"10-12":["Wilfrid"],"10-13":["Géraud"],"10-14":["Juste"],"10-15":["Thérèse d'Avila"],"10-16":["Edwige"],"10-17":["Baudouin"],"10-18":["Luc"],"10-19":["René"],"10-20":["Adeline"],"10-21":["Céline"],"10-22":["Élodie"],"10-23":["Jean de Capistran"],"10-24":["Florentin"],"10-25":["Crépin"],"10-26":["Dimitri"],"10-27":["Émeline"],"10-28":["Simon","Jude"],"10-29":["Narcisse","Elisa","Élisa"],"10-30":["Bienvenu"],"10-31":["Quentin"],
  "11-01":["Toussaint"],"11-02":["Défunts","Victoire"],"11-03":["Hubert","Martin de Porres"],"11-04":["Charles Borromée"],"11-05":["Sylvie"],"11-06":["Bertille"],"11-07":["Carine"],"11-08":["Geoffrey"],"11-09":["Théodore"],"11-10":["Léon"],"11-11":["Martin de Tours","Martin"],"11-12":["Christian"],"11-13":["Brice","Julien"],"11-14":["Sidoine"],"11-15":["Albert"],"11-16":["Marguerite d'Écosse"],"11-17":["Élisabeth de Hongrie","Élisabeth","Élise","Elisabeth","Elise"],"11-18":["Aude"],"11-19":["Tanguy"],"11-20":["Edmond"],"11-21":["Présentation","Marine"],"11-22":["Cécile"],"11-23":["Clément"],"11-24":["Flora"],"11-25":["Catherine d'Alexandrie"],"11-26":["Delphine"],"11-27":["Sévrin"],"11-28":["Jacques de la Marche"],"11-29":["Saturnin"],"11-30":["André"],
  "12-01":["Florence"],"12-02":["Viviane"],"12-03":["François-Xavier"],"12-04":["Barbara","Jean Damascène"],"12-05":["Gérald"],"12-06":["Nicolas"],"12-07":["Ambroise"],"12-08":["Immaculée Conception","Marie"],"12-09":["Pierre Fourier"],"12-10":["Romaric"],"12-11":["Daniel"],"12-12":["Jeanne de Chantal"],"12-13":["Lucie","Lucia"],"12-14":["Odile"],"12-15":["Ninon"],"12-16":["Alice"],"12-17":["Gaël"],"12-18":["Gatien"],"12-19":["Urbain"],"12-20":["Abraham"],"12-21":["Pierre Canisius"],"12-22":["Françoise-Xavière"],"12-23":["Armand"],"12-24":["Adèle","Adélaïde"],"12-25":["Noël"],"12-26":["Étienne","Steven","Zoé"],"12-27":["Jean"],"12-28":["Innocents"],"12-29":["David"],"12-30":["Roger"],"12-31":["Sylvestre"]
};

// ─────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchDay(month, day) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ country: 'fr', day, month });
    const options = {
      hostname: 'nameday.abalin.net',
      path: '/api/V1/getdate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // V1 format: { day, month, nameday: { fr: "Julie, Julia" }, country }
          const raw = json?.nameday?.fr || null;
          if (raw) {
            const names = raw.split(',').map(n => n.trim()).filter(Boolean);
            resolve(names);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

function buildIndex(byDate) {
  const byName = {};
  for (const [date, names] of Object.entries(byDate)) {
    for (const name of names) {
      // sans accents
      const norm = name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z-]/g, '');
      if (norm && !byName[norm]) byName[norm] = date;
      // avec accents
      const lower = name.toLowerCase();
      if (!byName[lower]) byName[lower] = date;
    }
  }
  return byName;
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  const merged = JSON.parse(JSON.stringify(base)); // deep copy
  const daysInMonth = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let apiHits = 0;
  let apiMisses = 0;

  process.stderr.write('🚀 Démarrage — récupération API abalin.net (fr)...\n');

  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= daysInMonth[month]; day++) {
      const key = `${pad(month)}-${pad(day)}`;
      const apiNames = await fetchDay(month, day);

      if (apiNames && apiNames.length > 0) {
        const existing = merged[key] || [];
        merged[key] = [...new Set([...existing, ...apiNames])];
        apiHits++;
        process.stderr.write(`✓ ${key}: ${apiNames.join(', ')}\n`);
      } else {
        apiMisses++;
        process.stderr.write(`- ${key}: API sans résultat, fallback base\n`);
      }

      await sleep(200);
    }
  }

  const byName = buildIndex(merged);

  process.stderr.write(`\n✅ Terminé — ${apiHits} jours enrichis via API, ${apiMisses} sans données API\n`);
  process.stderr.write(`👤 ${Object.keys(byName).length} prénoms dans l'index\n\n`);

  // ─── Vérifications rapides ───
  const checks = ['julie', 'sophie', 'chloe', 'camille', 'leo', 'hugo', 'baptiste', 'florian'];
  process.stderr.write('🔍 Vérifications :\n');
  for (const p of checks) {
    process.stderr.write(`  ${p} → ${byName[p] || '❌ NON TROUVÉ'}\n`);
  }
  process.stderr.write('\n');

  // ─── OUTPUT JSON (stdout uniquement — copier-coller) ───
  process.stderr.write('═══════════════════════════════════════════════════\n');
  process.stderr.write('📋 COPIE DES FICHIERS JSON (stdout ci-dessous)\n');
  process.stderr.write('  namedays-fr-by-date.json :\n');
  process.stderr.write('═══════════════════════════════════════════════════\n');

  // On sépare les deux JSON par un marqueur clair
  process.stdout.write('/* ==== namedays-fr-by-date.json ==== */\n');
  process.stdout.write(JSON.stringify(merged, null, 2));
  process.stdout.write('\n\n/* ==== namedays-fr-by-name.json ==== */\n');
  process.stdout.write(JSON.stringify(byName, null, 2));
  process.stdout.write('\n');

  process.stderr.write('✅ JSON affiché dans stdout. Tu peux copier-coller !\n');
}

main().catch(err => {
  process.stderr.write('ERREUR FATALE: ' + err.message + '\n');
  process.exit(1);
});