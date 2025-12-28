const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// إعداد Gemini باستخدام المتغير البيئي
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const OUT_DIR = path.join(__dirname, "output");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const JOBS = new Map();

// دالة توليد السكربت - أصلية 100%
async function generateGeminiStory(topic) {
  const prompt = `Create a short video script about: ${topic}. 100% original, no copyright. Return ONLY JSON: {"title": "", "scenes": [{"text": ""}]}`;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(text);
}

// الرابط اللي بتطلبه من n8n
app.post("/api/short-video", async (req, res) => {
  const id = uuidv4();
  // بنرد فوراً عشان n8n ما يفكر إن السيرفر معلق
  res.json({ id, status: "processing" }); 

  try {
    const script = await generateGeminiStory(req.body.topic || "mystery");
    fs.writeFileSync(path.join(OUT_DIR, `${id}.json`), JSON.stringify(script));
    JOBS.set(id, { status: "done", result: script });
  } catch (e) {
    JOBS.set(id, { status: "error", error: e.message });
  }
});

// رابط عشان n8n يشيك هل خلص السيرفر ولا لسه
app.get("/api/status/:id", (req, res) => {
  const job = JOBS.get(req.params.id);
  res.json(job || { status: "not_found" });
});

app.listen(process.env.PORT || 3000, () => console.log("Server Running ✅"));
