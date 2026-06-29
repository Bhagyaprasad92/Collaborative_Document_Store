const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const documentRoutes = require("./routes/document.routes");
const searchRoutes = require("./routes/search.routes");
const analyticsRoutes = require("./routes/analytics.routes");

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Collaborative Document Store API Running",
    version: "1.0.0",
    endpoints: {
      documents: "/api/documents",
      search: "/api/search",
      analytics: "/api/analytics",
    },
  });
});

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

app.use("/api/documents", documentRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/analytics", analyticsRoutes);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

module.exports = app;