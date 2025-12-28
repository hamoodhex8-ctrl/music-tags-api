const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// إعداد Gemini - تأكد من إضافة GEMINI_API_KEY في إعدادات Render
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const OUT_DIR = path.join(__dirname, "output");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const JOBS = new Map();

// دالة توليد السكربت بدون حقوق ملكية
async function generateOriginalScript(topic) {
  const prompt = `Create a 100% original cinematic short video script about: ${topic}. 
  Rules: No copyrighted characters, no existing movies.
  Return ONLY a JSON object: {"title": "string", "scenes": [{"visual": "string", "audio": "string"}]}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(text);
}

// 1. رابط بدء العملية (هذا اللي تحطه في n8n)
app.post("/api/short-video", (req, res) => {
  const id = uuidv4();
  const topic = req.body.topic || "Mystery Story";

  // رد سريع لمنع n8n من الفصل
  res.json({ id, status: "processing" });

  // ابدأ الشغل بالخلفية
  JOBS.set(id, { status: "running", createdAt: new Date() });

  generateOriginalScript(topic)
    .then(script => {
      const filePath = path.join(OUT_DIR, `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(script));
      JOBS.set(id, { status: "done", result: script });
    })
    .catch(err => {
      JOBS.set(id, { status: "error", error: err.message });
    });
});

// 2. رابط فحص الحالة (Polling)
app.get("/api/status/:id", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// 3. رابط تحميل النتيجة النهائية
app.get("/api/result/:id", (req, res) => {
  const file = path.join(OUT_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.status(404).send("Not ready");
  res.sendFile(file);
});

app.get("/", (req, res) => res.send("Gemini Video API is Live! ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
