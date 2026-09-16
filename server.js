require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- REUSABLE PROMPT ---
const getSystemPrompt = () => `You are a professional ATS analyzer. Return ONLY a valid JSON object.
Format: {"score": 0, "matched_keywords": [], "missing_keywords": [], "strengths": [], "improvements": []}`;

// --- PROVIDER 1: GEMINI (Primary) ---
async function tryGemini(cv, jd) {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) throw new Error("GEMINI_API_KEY is missing");
  
  // Using the stable 1.5-flash model
  const MODEL = 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${getSystemPrompt()}\n\nAnalyze CV: ${cv} against JD: ${jd}` }] }],
      generationConfig: { temperature: 0.1, topK: 1 }
    })
  });
  
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Gemini API Error");
  
  const rawText = data.candidates[0].content.parts[0].text;
  return JSON.parse(rawText.replace(/```json|```/g, '').trim());
}

// --- PROVIDER 2: CEREBRAS AI (Fallback) ---
async function tryCerebras(cv, jd) {
  const API_KEY = process.env.CEREBRAS_API_KEY;
  if (!API_KEY) throw new Error("CEREBRAS_API_KEY is missing");
  
  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama3.1-70b",
      messages: [
        { role: "system", content: getSystemPrompt() },
        { role: "user", content: `Analyze CV: ${cv} against JD: ${jd}` }
      ],
      temperature: 0.1
    })
  });
  
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Cerebras API Error");
  
  const rawText = data.choices[0].message.content;
  return JSON.parse(rawText.replace(/```json|```/g, '').trim());
}

// --- MAIN API ROUTE ---
app.post('/api/analyze', async (req, res, next) => {
  try {
    const { cv, jd } = req.body;
    if (!cv || !jd) {
      return res.status(400).json({ error: "CV and JD are required." });
    }

    try {
      console.log("Stage 1: Attempting Gemini...");
      const result = await tryGemini(cv, jd);
      return res.json(result);
    } catch (err) {
      console.error("Gemini Failed:", err.message);
      
      try {
        console.log("Stage 2: Falling back to Cerebras AI...");
        const result = await tryCerebras(cv, jd);
        return res.json(result);
      } catch (err2) {
        console.error("Cerebras AI Failed:", err2.message);
        return res.status(503).json({ error: "High traffic. AI engines are currently at capacity or API keys are missing." });
      }
    }
  } catch (globalErr) {
    next(globalErr);
  }
});

// Fallback for SPA routing
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Global Error Handler to guarantee JSON response instead of HTML crashes
app.use((err, req, res, next) => {
  console.error("Fatal Server Error:", err);
  res.status(500).json({ error: "Internal Server Error occurred. Please check Vercel runtime logs for details." });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Sulisumen Peter Hub: AI Active on ${PORT}`));
}

module.exports = app;
