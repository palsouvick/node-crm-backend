const Customer = require("../models/Customer");
const Company = require("../models/Company");

// One-off migration: best-effort links existing Customer.company free-text
// values to a real Company.companyRef via an exact case-insensitive name
// match. Customers with no match are left unset rather than guessed at.
const backfillCustomerCompanyRef = async () => {
  const companies = await Company.find({ isDeleted: false }).select("_id name");
  const companyByName = new Map(companies.map((c) => [c.name.trim().toLowerCase(), c._id]));

  const customers = await Customer.find({
    isDeleted: false,
    company: { $nin: [null, ""] },
    companyRef: { $exists: false },
  }).select("_id company");

  let matched = 0;
  let skipped = 0;

  for (const customer of customers) {
    const companyId = companyByName.get(customer.company.trim().toLowerCase());
    if (companyId) {
      await Customer.updateOne({ _id: customer._id }, { $set: { companyRef: companyId } });
      matched += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(
    `Backfill complete: ${matched} customer(s) linked, ${skipped} skipped (no matching company name), ${customers.length} total considered.`
  );
};

module.exports = { backfillCustomerCompanyRef };

if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");

  (async () => {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI must be set in the environment before running this script.");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    try {
      await backfillCustomerCompanyRef();
    } finally {
      await mongoose.disconnect();
    }
  })().catch((error) => {
    console.error("Failed to backfill customer company references:", error);
    process.exit(1);
  });
}
