// server.js
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
// Vercel sets the PORT automatically; 3000 is our local fallback
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/analyze', async (req, res) => {
  // Use a triple-check for the API key to ensure Vercel finds it
  const API_KEY = process.env.GEMINI_API_KEY || process.env.gemini_api_key;

  if (!API_KEY) {
    console.error("Missing GEMINI_API_KEY in Environment Variables");
    return res.status(500).json({ 
      error: 'API Key missing. Please check Vercel Project Settings > Environment Variables.' 
    });
  }

  const { cv, jd } = req.body;
  
  // Prompt optimized for Lisumen Innovative Hub branding
  const prompt = `You are an ATS analysis expert. Analyze the following CV against the Job Description. 
  Return ONLY a valid JSON object with these keys: score, matched_keywords, missing_keywords, section_scores, strengths, improvements. 
  
  CV: ${cv}
  JD: ${jd}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    
    if (data.error) {
      return res.status(response.status).json({ error: data.error.message });
    }

    const rawText = data.candidates[0].content.parts[0].text;
    const cleanJson = rawText.replace(/```json|```/g, '').trim();
    
    res.json(JSON.parse(cleanJson));
  } catch (err) {
    res.status(500).json({ error: 'AI Analysis failed. Please try again.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// For Vercel, we export the app
module.exports = app;

// For local or VPS, we listen
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
