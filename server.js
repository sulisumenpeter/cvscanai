// server.js — Triple Fallback Strategy | Sulisumen Peter
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- REUSABLE PROMPT ---
const getSystemPrompt = () => `You are a professional ATS analyzer. Return ONLY a valid JSON object.
Format: {"score": 0, "matched_keywords": [], "missing_keywords": [], "strengths": [], "improvements": []}`;

// --- PROVIDER 1: GEMINI (Primary) ---
async function tryGemini(cv, jd) {
  const API_KEY = process.env.GEMINI_API_KEY;
  const MODEL = 'gemini-3-flash-preview';
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
  if (data.error) throw new Error(data.error.message);
  
  const rawText = data.candidates[0].content.parts[0].text;
  return JSON.parse(rawText.replace(/```json|```/g, '').trim());
}

// --- PROVIDER 2: CEREBRAS AI (Fallback) ---
async function tryCerebras(cv, jd) {
  const API_KEY = process.env.CEREBRAS_API_KEY;
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
app.post('/api/analyze', async (req, res) => {
  const { cv, jd } = req.body;

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
      res.status(503).json({ error: "High traffic. AI engines are currently at capacity. Please try again in 1 minute." });
    }
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Sulisumen Peter Hub: AI Fallback Active on ${PORT}`));
}

module.exports = app;
