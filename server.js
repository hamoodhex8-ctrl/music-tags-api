const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// --- حط مفتاحك هنا مباشرة بدلاً من كلمة YOUR_API_KEY_HERE ---
const API_KEY = "AIzaSyBByfI83sgoceHCuQ50fNsLkU0CI_NnTQ4"; 
// --------------------------------------------------------

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const OUT_DIR = path.join(__dirname, "output");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const JOBS = new Map();

async function generateOriginalScript(topic) {
  const prompt = `Create a 100% original cinematic short video script about: ${topic}. 
  Return ONLY a JSON object: {"title": "string", "scenes": [{"visual": "string", "audio": "string"}]}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(text);
}

// الرابط الأساسي للبداية
app.post("/api/short-video", (req, res) => {
  const id = uuidv4();
  const topic = req.body.topic || "Mystery Story";
  res.json({ id, status: "processing" }); // رد سريع لـ n8n

  JOBS.set(id, { status: "running" });

  generateOriginalScript(topic)
    .then(script => {
      JOBS.set(id, { status: "done", result: script });
    })
    .catch(err => {
      JOBS.set(id, { status: "error", error: err.message });
    });
});

// رابط فحص الحالة
app.get("/api/status/:id", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.get("/", (req, res) => res.send("API is Live with Direct Key! ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
