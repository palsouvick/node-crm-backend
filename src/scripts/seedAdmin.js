const bcrypt = require("bcryptjs");
const User = require("../models/User");

// Safe to call on every server start: does nothing unless SEED_ADMIN_EMAIL/PASSWORD
// are set, and does nothing if that admin already exists — so it only ever seeds once.
const seedAdminUser = async () => {
  const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_PHONE } = process.env;

  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    return;
  }

  const existing = await User.findOne({ email: SEED_ADMIN_EMAIL });
  if (existing) {
    return;
  }

  const hashedPassword = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);
  await User.create({
    name: SEED_ADMIN_NAME || "Admin",
    email: SEED_ADMIN_EMAIL,
    phone: SEED_ADMIN_PHONE || undefined,
    password: hashedPassword,
    role: "admin",
    status: "active",
  });

  console.log(`Admin user created for ${SEED_ADMIN_EMAIL}.`);
};

module.exports = { seedAdminUser };

// Standalone usage: `npm run seed:admin` — connects and disconnects on its own,
// and fails loudly (unlike the auto-run path) if required env vars are missing.
if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");

  (async () => {
    if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) {
      console.error(
        "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in the environment before seeding."
      );
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    try {
      const existing = await User.findOne({ email: process.env.SEED_ADMIN_EMAIL });
      if (existing) {
        console.log(`User with email ${process.env.SEED_ADMIN_EMAIL} already exists, skipping seed.`);
        return;
      }
      await seedAdminUser();
    } finally {
      await mongoose.disconnect();
    }
  })().catch((error) => {
    console.error("Failed to seed admin user:", error);
    process.exit(1);
  });
}
