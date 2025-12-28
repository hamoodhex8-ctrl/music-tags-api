const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// إعداد Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const OUT_DIR = path.join(__dirname, "output");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const JOBS = new Map();

// دالة توليد المحتوى باستخدام Gemini (أصلي 100%)
async function generateGeminiStory(topic) {
  const prompt = `Create a 100% original cinematic short video script about: ${topic}. 
  Rules: No copyrighted characters, no celebrities, high engagement.
  Return the response as a valid JSON object ONLY with this structure:
  { "title": "string", "scenes": [{ "visual": "string", "audio": "string" }] }`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();
  
  // تنظيف النص من أي علامات Markdown قد تضعها Gemini
  text = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(text);
}

app.post("/api/short-video", async (req, res) => {
  const id = uuidv4();
  res.json({ id, status: "processing" }); // رد سريع لمنع الفصل

  JOBS.set(id, { status: "running" });
  try {
    const script = await generateGeminiStory(req.body.topic || "Adventure");
    fs.writeFileSync(path.join(OUT_DIR, `${id}.json`), JSON.stringify(script));
    JOBS.set(id, { status: "done", result: script });
  } catch (e) {
    JOBS.set(id, { status: "error", error: e.message });
  }
});

app.get("/api/status/:id", (req, res) => {
  res.json(JOBS.get(req.params.id) || { error: "Not found" });
});

app.listen(process.env.PORT || 3000, () => console.log("Gemini API Ready!"));
