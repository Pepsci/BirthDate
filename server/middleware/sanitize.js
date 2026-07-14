// middleware/sanitize.js
// Anti-injection NoSQL : retire des entrées utilisateur les clés dangereuses
// pour MongoDB (opérateurs commençant par "$" ou contenant un ".").
// Neutralise les payloads type { "email": { "$ne": null } }.

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    value.forEach(sanitizeValue);
    return value;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete value[key];
      } else {
        sanitizeValue(value[key]);
      }
    }
  }
  return value;
}

module.exports = function mongoSanitize(req, res, next) {
  if (req.body) sanitizeValue(req.body);
  if (req.query) sanitizeValue(req.query);
  if (req.params) sanitizeValue(req.params);
  next();
};
