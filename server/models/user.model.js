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
  date: [{ type: Schema.Types.ObjectId, ref: "date" }],
  resetToken: String,
});

const userModel = model("User", userSchema);

module.exports = userModel;
