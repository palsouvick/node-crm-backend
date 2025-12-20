const app = require("./src/app");
const connectDB = require("./src/config/db");
require("dotenv").config();

connectDB();
console.log("Starting server..."+process.env.PORT);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
