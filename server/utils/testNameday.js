const { findNameDay } = require("./namedayHelper");

// Tests de base
console.log("=== Tests de base ===");
console.log("Marie:", findNameDay("Marie"));
console.log("Jean:", findNameDay("Jean"));
console.log("Pierre:", findNameDay("Pierre"));
console.log("Louis:", findNameDay("Louis"));
console.log("Arthur:", findNameDay("Arthur"));

// Tests prénoms composés
console.log("\n=== Prénoms composés ===");
console.log("Jean-Marc:", findNameDay("Jean-Marc"));
console.log("Jean-Baptiste:", findNameDay("Jean-Baptiste"));
console.log("Marie-Ange:", findNameDay("Marie-Ange"));

// Tests ordre inversé
console.log("\n=== Ordre inversé ===");
console.log("Jarrige Valentin:", findNameDay("Jarrige Valentin"));
console.log("Filippi Joan:", findNameDay("Filippi Joan"));
