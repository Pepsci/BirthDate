const { Schema, model } = require("mongoose");

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  surname: String,
  avatar: {
    type: String,
    default:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/480px-No_image_available.svg.png",
  },
  birthDate: Date,
  resetToken: String,
  resetTokenExpires: Date,
  verificationToken: String,
  isVerified: { type: Boolean, default: false },
  lastVerificationEmailSent: Date,
});

const UserModel = model("user", userSchema);

module.exports = UserModel;
