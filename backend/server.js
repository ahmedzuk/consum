const express = require("express");
const cors = require("cors");
const pool = require("./database/config");
const initDatabase = require("./database/init");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("frontend"));

// Initialize database
initDatabase();

// Routes will go here (same as previous example)

// Health check route
app.get("/", (req, res) => {
  res.send("Consumption Management API is running!");
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

// Add all your previous routes here...
