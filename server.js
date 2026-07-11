require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/db");
const { seedAdminUser } = require("./src/scripts/seedAdmin");


connectDB().then(() => seedAdminUser().catch((error) => {
  console.error("Admin seed failed:", error);
}));
console.log("Starting server..."+process.env.PORT);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
