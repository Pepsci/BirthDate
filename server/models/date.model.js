const { Schema, model } = require("mongoose");

const dateSchema = Schema({
  date: { type: Date, required: true },
  name: String,
  surname: String,
  owner: { type: Schema.Types.ObjectId, ref: "user" },
  comment: {
    type: Array,
    default: [],
  },
});

const dateModel = model("Date", dateSchema);

module.exports = dateModel;
