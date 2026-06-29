require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const seedOnStartup = require("./scripts/seed");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Seed if the collection is empty (non-blocking for server startup)
  seedOnStartup().catch((err) =>
    console.error("⚠️  Seed on startup failed:", err.message)
  );

  // 3. Start HTTP server
  app.listen(PORT, () => {
    console.log(`🚀  Server running on port ${PORT}`);
  });
};

startServer();