const express = require("express");
const path = require("path");
const { loadPanoramas } = require("./loadPanoramas.js");

const app = express();
const PORT = 8000;

// 1) Load panoramas once on the Node side
const panoramas = loadPanoramas();

// 2) Serve everything in THIS folder (where server.js is) via /360
app.use("/360", express.static(path.join(__dirname)));

// 3) Provide the panoramas JSON at /api/panoramas
app.get("/api/panoramas", (req, res) => {
  res.json(panoramas);
});

// 4) When the user goes to /360/web, send them index.html
app.get("/360/web", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 5) Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/360/web`);
});
