const DateModel = require("../models/date.model");

async function createFriendDates(user1, user2) {
  // Date pour user1 avec les infos de user2
  if (user2.birthDate) {
    const exists = await DateModel.findOne({
      owner: user1._id,
      linkedUser: user2._id,
    });
    if (!exists) {
      await DateModel.create({
        date: user2.birthDate,
        name: user2.name,
        surname: user2.surname || "",
        owner: user1._id,
        linkedUser: user2._id,
        family: false,
        receiveNotifications: true,
        notificationPreferences: { timings: [1], notifyOnBirthday: true },
        comment: [],
        gifts: [],
      });
      console.log(`✅ Date créée pour ${user1.name} (ami: ${user2.name})`);
    }
  }

  // Date pour user2 avec les infos de user1
  if (user1.birthDate) {
    const exists = await DateModel.findOne({
      owner: user2._id,
      linkedUser: user1._id,
    });
    if (!exists) {
      await DateModel.create({
        date: user1.birthDate,
        name: user1.name,
        surname: user1.surname || "",
        owner: user2._id,
        linkedUser: user1._id,
        family: false,
        receiveNotifications: true,
        notificationPreferences: { timings: [1], notifyOnBirthday: true },
        comment: [],
        gifts: [],
      });
      console.log(`✅ Date créée pour ${user2.name} (ami: ${user1.name})`);
    }
  }
}

module.exports = { createFriendDates };
