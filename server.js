const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
// رفعنا الـ limit عشان لو بعت بيانات scenes ضخمة ما يفصل
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const OUT_DIR = path.join(__dirname, "output");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const JOBS = new Map();

// دالة توليد السكربت مع موديل صحيح وبرومبت قوي لمنع الكوبي رايت
async function generateOriginalStory(topic) {
  if (!OPENAI_API_KEY) throw new Error("API Key is missing!");

  const body = {
    model: "gpt-4o-mini", // الموديل الصحيح والأسرع
    messages: [
      {
        role: "system",
        content: `You are a creative director for YouTube Shorts. 
        Strict Rules:
        1. 100% Original content only. 
        2. No copyrighted characters, movies, or real-life celebrities.
        3. Create a high-engagement, cinematic vibe.
        4. Output MUST be valid JSON only.`
      },
      {
        role: "user",
        content: `Create a unique cinematic short video script about: ${topic}. 
        Format: { "title": "", "scenes": [{ "visual": "", "audio": "" }] }`
      }
    ],
    response_format: { type: "json_object" }
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  return JSON.parse(data.choices[0].message.content);
}

// الرابط الأساسي للتأكد إن السيرفر شغال
app.get("/", (req, res) => {
  res.send("Video Automation API: Status Online ✅");
});

// المسار اللي بتطلبه من n8n
app.post("/api/short-video", async (req, res) => {
  const id = uuidv4();
  const topic = req.body.topic || "Mysterious discovery in space";

  // بنرد فوراً بـ ID عشان n8n ما يظل معلق ويفصل Connection Lost
  res.json({ id, status: "processing", message: "Job started" });

  // المعالجة بتصير بالخلفية (Background)
  JOBS.set(id, { status: "running", createdAt: new Date().toISOString() });

  try {
    const script = await generateOriginalStory(topic);
    const filePath = path.join(OUT_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(script, null, 2));

    JOBS.set(id, {
      status: "done",
      result: script,
      downloadUrl: `/api/result/${id}`
    });
    console.log(`Job ${id} completed successfully.`);
  } catch (e) {
    console.error(`Job ${id} failed:`, e.message);
    JOBS.set(id, { status: "error", error: e.message });
  }
});

// مسار عشان n8n يشيك هل خلص الشغل ولا لسه
app.get("/api/status/:id", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.get("/api/result/:id", (req, res) => {
  const file = path.join(OUT_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.status(404).send("File not ready yet");
  res.sendFile(file);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
