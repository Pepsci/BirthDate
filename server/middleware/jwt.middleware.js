// middleware/jwt.middleware.js

// const jwt = require("express-jwt");
const { expressjwt } = require("express-jwt");

// Instantiate the JWT token validation middleware
const isAuthenticated = expressjwt({
  secret: process.env.TOKEN_SECRET,
  algorithms: ["HS256"],
  requestProperty: "payload",
  getToken: getTokenFromHeaders,
});

// Function used to extracts the JWT token from Authorization header or httpOnly cookie
function getTokenFromHeaders(req) {
  if (
    req.headers.authorization &&
    req.headers.authorization.split(" ")[0] === "Bearer"
  ) {
    return req.headers.authorization.split(" ")[1];
  }
  if (req.cookies && req.cookies.authToken) {
    return req.cookies.authToken;
  }
  return null;
}

// Export the middleware so that we can use it to create a protected routes
module.exports = {
  isAuthenticated,
};
