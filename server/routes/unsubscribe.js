// routes/unsubscribe.js
const express = require("express");
const router = express.Router();
const userModel = require("../models/user.model");
const dateModel = require("../models/date.model");

// Route GET pour le désabonnement via email
router.get("/", async (req, res, next) => {
  try {
    const { email, dateid } = req.query;

    if (!email) {
      // Renvoyer une page HTML d'erreur
      return res.send(`
        <html>
          <head>
            <title>Erreur de désabonnement</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; text-align: center; }
              .error { color: #e74c3c; }
              .container { border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              a { color: #3498db; text-decoration: none; }
              a:hover { text-decoration: underline; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Gestion des notifications</h1>
              <h2 class="error">Erreur</h2>
              <p>Email manquant. Impossible de traiter votre demande de désabonnement.</p>
              <p>Veuillez <a href="${process.env.FRONTEND_URL}/login">vous connecter</a> pour gérer vos préférences.</p>
            </div>
          </body>
        </html>
      `);
    }

    // Log pour debug
    console.log("Tentative de désabonnement pour l'email:", email);
    if (dateid) {
      console.log("Désabonnement spécifique pour la date:", dateid);
    }

    try {
      // Si dateid est spécifié, désabonner d'un anniversaire spécifique
      if (dateid) {
        const date = await dateModel.findByIdAndUpdate(
          dateid,
          { receiveNotifications: false },
          { new: true }
        );

        if (!date) {
          console.log("Date non trouvée:", dateid);
          throw new Error("Anniversaire non trouvé");
        }

        console.log(
          `Notifications désactivées pour l'anniversaire de ${date.name} ${date.surname}`
        );

        // Renvoyer une page HTML de succès spécifique à cet anniversaire
        return res.send(`
          <html>
            <head>
              <title>Désabonnement réussi</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; text-align: center; }
                .success { color: #2ecc71; }
                .container { border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                a { color: #3498db; text-decoration: none; }
                a:hover { text-decoration: underline; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Gestion des notifications</h1>
                <h2 class="success">Succès !</h2>
                <p>Vous ne recevrez plus de notifications pour l'anniversaire de ${date.name} ${date.surname}.</p>
                <p>Vous pouvez désormais fermer cette page ou <a href="${process.env.FRONTEND_URL}/login">vous connecter</a> pour gérer vos préférences.</p>
              </div>
            </body>
          </html>
        `);
      } else {
        // Désabonner de toutes les notifications d'anniversaire
        const userBefore = await userModel.findOne({
          email: { $regex: new RegExp("^" + email + "$", "i") },
        });

        if (!userBefore) {
          console.log("Utilisateur non trouvé avec cet email:", email);
          throw new Error("Utilisateur non trouvé");
        }

        console.log(
          "État avant mise à jour:",
          userBefore.receiveBirthdayEmails
        );

        // Faire la mise à jour
        const result = await userModel.findOneAndUpdate(
          { email: { $regex: new RegExp("^" + email + "$", "i") } },
          { receiveBirthdayEmails: false },
          { new: true }
        );

        console.log("État après mise à jour:", result.receiveBirthdayEmails);
        console.log("Utilisateur désabonné avec succès:", result.email);
      }

      // Si on arrive ici, c'est pour le désabonnement général
      if (!dateid) {
        // Renvoyer une page HTML de succès
        res.send(`
          <html>
            <head>
              <title>Désabonnement réussi</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; text-align: center; }
                .success { color: #2ecc71; }
                .container { border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                a { color: #3498db; text-decoration: none; }
                a:hover { text-decoration: underline; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Gestion des notifications</h1>
                <h2 class="success">Succès !</h2>
                <p>Vous avez été désabonné avec succès des notifications d'anniversaire.</p>
                <p>Vous pouvez désormais fermer cette page ou <a href="${process.env.FRONTEND_URL}/login">vous connecter</a> pour gérer vos préférences.</p>
              </div>
            </body>
          </html>
        `);
      }
    } catch (error) {
      console.error("Erreur lors du désabonnement:", error);

      // Renvoyer une page HTML d'erreur
      res.status(404).send(`
        <html>
          <head>
            <title>Erreur de désabonnement</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; text-align: center; }
              .error { color: #e74c3c; }
              .container { border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              a { color: #3498db; text-decoration: none; }
              a:hover { text-decoration: underline; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Gestion des notifications</h1>
              <h2 class="error">Erreur</h2>
              <p>Une erreur est survenue lors du traitement de votre demande: ${error.message}</p>
              <p>Veuillez <a href="${process.env.FRONTEND_URL}/login">vous connecter</a> pour gérer vos préférences.</p>
            </div>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error("Erreur générale lors du désabonnement:", error);
    res.status(500).send(`
      <html>
        <head>
          <title>Erreur serveur</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; text-align: center; }
            .error { color: #e74c3c; }
            .container { border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Erreur serveur</h1>
            <p class="error">Une erreur interne s'est produite. Veuillez réessayer ultérieurement.</p>
          </div>
        </body>
      </html>
    `);
  }
});

// Conserver la route POST si vous l'utilisez ailleurs
router.post("/", async (req, res, next) => {
  // Code pour la route POST (si nécessaire)
});

module.exports = router;
