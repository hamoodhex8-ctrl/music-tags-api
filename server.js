const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Music Tags API is running");
});

// Main endpoint
app.get("/api/music-tags", (req, res) => {
  res.json({
    tags: ["ai", "music", "english", "automation"]
  });
});

// Render uses PORT automatically
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
