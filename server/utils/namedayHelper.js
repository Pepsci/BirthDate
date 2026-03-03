const namedays = require("../data/namedays-fr.json");

/**
 * Extrait tous les prénoms possibles d'un nom de saint
 * "St-Aloysius de Gonzague (ou Louis)" → ["aloysius", "louis"]
 */
function extractAllNames(saintName) {
  const names = [];
  const cleaned = saintName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Prénom principal (enlever St/Ste et les suffixes)
  const mainName = cleaned
    .replace(/^(st-|ste-|saint-|sainte-)/i, "")
    .replace(/\s+(le|la|de|du|des|d'|l')\s+.*/i, "")
    .trim();

  if (mainName) names.push(mainName);

  // Variantes entre parenthèses : "(ou Louis)" → "louis"
  const variantMatch = cleaned.match(/\(ou\s+([^)]+)\)/i);
  if (variantMatch) {
    names.push(variantMatch[1].trim());
  }

  return names;
}

/**
 * Trouve la date de fête d'un prénom
 */
function findNameDay(firstName) {
  if (!firstName) return null;

  let cleanedFirstName = firstName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // Si prénom composé (Jean-Marc), prendre le premier
  if (cleanedFirstName.includes("-")) {
    cleanedFirstName = cleanedFirstName.split("-")[0];
  }

  // Si espace détecté, essayer les deux ordres
  let possibleNames = [cleanedFirstName];
  if (cleanedFirstName.includes(" ")) {
    const parts = cleanedFirstName.split(" ");
    possibleNames = [parts[0], parts[parts.length - 1]];
  }

  // Parcourir tous les mois
  for (const month in namedays) {
    for (const day in namedays[month]) {
      const saints = namedays[month][day];

      for (const saint of saints) {
        const saintNames = extractAllNames(saint);

        // Vérifier si un des prénoms recherchés match un des noms du saint
        for (const searchName of possibleNames) {
          if (saintNames.includes(searchName)) {
            const formattedMonth = month.padStart(2, "0");
            const formattedDay = day.padStart(2, "0");
            return `${formattedMonth}-${formattedDay}`;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Récupère tous les prénoms qui fêtent leur fête aujourd'hui
 */
function getNameDaysForDate(date) {
  const [month, day] = date.split("-").map((d) => parseInt(d, 10).toString());

  if (!namedays[month] || !namedays[month][day]) {
    return [];
  }

  return namedays[month][day].flatMap((saint) => extractAllNames(saint));
}

module.exports = {
  findNameDay,
  getNameDaysForDate,
  extractAllNames,
};
