require("dotenv").config();
const mongoose = require("mongoose");
const SupportMessage = require("./models/supportMessage.model");
(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const all = await SupportMessage.find().select("subject category relatedEvent status createdAt").sort({createdAt:-1}).limit(10).lean();
  console.log(`\n${all.length} ticket(s) récents :\n`);
  all.forEach(t => console.log(
    `  ${t.createdAt.toISOString().slice(0,16)}  cat=${t.category || "(absent)"}  ` +
    `event=${t.relatedEvent || "AUCUN"}  ${t.status}  « ${t.subject.slice(0,40)} »`
  ));
  console.log();
  await mongoose.disconnect();
})();
