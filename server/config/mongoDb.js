require("dotenv").config();
const mongoose = require("mongoose");

mongoose
  .connect(process.env.MONGO_URI)
  .then((x) => {
    console.log(`Connected to BirthDate name: "${x.connection.name}"`);
  })
  .catch((e) => {
    console.error("Error connecting to mongo", e);
  });
