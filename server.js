// server.js — Strict Truncation & Consistency | Sulisumen Peter
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' })); // Lowered limit to prevent huge payloads
app.use(express.static(path.join(__dirname, 'public')));

/**
 * STRICT TRUNCATION HELPER
 * Ensures we don't exceed token limits or rate limits
 */
function strictTruncate(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  // Cut at the max limit and add a marker for the AI
  return text.substring(0, maxChars) + "... [TEXT TRUNCATED TO SAVE QUOTA]";
}

app.post('/api/analyze', async (req, res) => {
  const API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API Key missing. Setup in Vercel settings.' });
  }

  // Destructure and immediately apply strict limits
  // We use 3000 for CV and 2000 for JD to stay well within the "Free Tier" comfort zone
  const cv = strictTruncate(req.body.cv, 3000); 
  const jd = strictTruncate(req.body.jd, 2000);

  if (!cv || !jd) return res.status(400).json({ error: 'CV and JD content are required.' });

  const MODEL_NAME = 'gemini-3-flash-preview';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

  const prompt = `You are an ATS simulation engine. Analyze the CV against the JD.
  Award points for keywords, experience, and certifications.
  
  Return ONLY JSON:
  {
    "score": 0,
    "matched_keywords": [],
    "missing_keywords": [],
    "section_scores": [],
    "strengths": [],
    "improvements": []
  }

  CV: ${cv}
  JD: ${jd}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.1, 
          topP: 0.1,        
          topK: 1,          
          maxOutputTokens: 1000 // Limits the length of the AI's response to save quota
        }
      })
    });

    const data = await response.json();

    // Handle the specific Quota/Rate Limit error gracefully
    if (data.error) {
      console.error("Gemini Error:", data.error.message);
      if (data.error.message.includes("quota")) {
        return res.status(429).json({ error: "AI Busy (Quota Exceeded). Please wait 60 seconds and try again." });
      }
      return res.status(response.status).json({ error: data.error.message });
    }

    const rawText = data.candidates[0].content.parts[0].text;
    const cleanJson = rawText.replace(/```json|```/g, '').trim();
    
    res.json(JSON.parse(cleanJson));

  } catch (err) {
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 CVScan AI active on port ${PORT}`));
}
