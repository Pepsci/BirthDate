const crypto = require("crypto");

function generateVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

async function sendVerificationEmail(email, token) {
  const client = new SESClient({ region: "eu-west-3" });

  const params = {
    Source: "no-reply@birthreminder.com",
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: { Data: "Vérification de votre adresse email" },
      Body: {
        Html: {
          Data: `<p>Merci de vérifier votre adresse email en cliquant sur le lien suivant : <a href="${process.env.FRONTEND_URL}/verify-email?token=${token}">Vérifier Email</a></p>`,
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    await client.send(command);
    console.log("Email de vérification envoyé");
  } catch (err) {
    console.error("Erreur lors de l'envoi de l'email de vérification : ", err);
  }
}

module.exports = { generateVerificationToken, sendVerificationEmail };
