const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const PORT = process.env.PORT || 3000;

// ================= CONFIG =================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// ================= STORAGE =================
const OUT_DIR = path.join(__dirname, "output");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const JOBS = new Map();

// ================= HELPERS =================
function mustHaveEnv(name, value) {
  if (!value) throw new Error(`Missing env var: ${name}`);
}

function nowISO() {
  return new Date().toISOString();
}

// ================= AI SCRIPT (NO COPYRIGHT) =================
async function generateStory(topic) {
  mustHaveEnv("OPENAI_API_KEY", OPENAI_API_KEY);

  const body = {
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `
You create ORIGINAL short video scripts.
Rules:
- No copyrighted references
- No celebrities
- No existing movies or stories
- 100% original
Return JSON only.
`
      },
      {
        role: "user",
        content: `Create a short cinematic script about: ${topic}`
      }
    ],
    response_format: { type: "json_object" }
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await r.json();
  return JSON.parse(data.choices[0].message.content);
}

// ================= API =================
app.get("/", (req, res) => {
  res.send("Music Tags + Video API running ✅");
});

app.post("/api/short-video", async (req, res) => {
  const id = uuidv4();
  JOBS.set(id, { status: "running", createdAt: nowISO() });

  try {
    const script = await generateStory(req.body.topic || "mystery short video");
    const filePath = path.join(OUT_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(script, null, 2));

    JOBS.set(id, {
      status: "done",
      result: script,
      download: `/api/result/${id}`
    });
  } catch (e) {
    JOBS.set(id, { status: "error", error: e.message });
  }

  res.json({ id });
});

app.get("/api/status/:id", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json(job);
});

app.get("/api/result/:id", (req, res) => {
  const file = path.join(OUT_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.status(404).send("Not ready");
  res.sendFile(file);
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
