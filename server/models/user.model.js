const { Schema, model } = require("mongoose");

const userSchema = new Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  surname: String,
  avatar: {
    type: String,
    default:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/1024px-No_image_available.svg.png",
  },
  birthDate: Date,
  resetToken: String,
  resetTokenExpires: Date,
  verificationToken: String,
  isVerified: { type: Boolean, default: false },
  resetToken: String,
});

const UserModel = model("User", userSchema);

module.exports = UserModel;
