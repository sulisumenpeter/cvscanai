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

// --- PROVIDER 2: TOGETHER AI (Fallback) ---
async function tryTogether(cv, jd) {
  const API_KEY = process.env.TOGETHER_API_KEY;
  const res = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "meta-llama/Llama-3-70b-chat-hf",
      messages: [
        { role: "system", content: getSystemPrompt() },
        { role: "user", content: `Analyze CV: ${cv} against JD: ${jd}` }
      ],
      temperature: 0.1
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return JSON.parse(data.choices[0].message.content);
}

// --- PROVIDER 3: FIREWORKS AI (Final Resort) ---
async function tryFireworks(cv, jd) {
  const API_KEY = process.env.FIREWORKS_API_KEY;
  const res = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "accounts/fireworks/models/llama-v3-70b-instruct",
      messages: [
        { role: "system", content: getSystemPrompt() },
        { role: "user", content: `Analyze CV: ${cv} against JD: ${jd}` }
      ],
      temperature: 0.1
    })
  });
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
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
      console.log("Stage 2: Falling back to Together AI...");
      const result = await tryTogether(cv, jd);
      return res.json(result);
    } catch (err2) {
      console.error("Together AI Failed:", err2.message);
      
      try {
        console.log("Stage 3: Falling back to Fireworks AI...");
        const result = await tryFireworks(cv, jd);
        return res.json(result);
      } catch (err3) {
        console.error("All Providers Failed.");
        res.status(503).json({ error: "High traffic. All AI engines are currently at capacity. Please try again in 1 minute." });
      }
    }
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Sulisumen Peter Hub: Triple Fallback Active on ${PORT}`));
}

module.exports = app;
