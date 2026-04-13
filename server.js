require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoint for Analysis
app.post('/api/analyze', async (req, res) => {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is missing from environment variables.' });
  }

  const { cv, jd } = req.body;

  const prompt = `You are an ATS expert. Analyze the CV against the JD. 
  Return ONLY a valid JSON object: { "score": 0-100, "matched_keywords": [], "missing_keywords": [], "section_scores": [], "strengths": [], "improvements": [] }
  
  CV: ${cv}
  JD: ${jd}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
    res.json({ result: resultText });
  } catch (err) {
    res.status(500).json({ error: 'AI processing failed.' });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Support both persistent servers (Render/VPS) and serverless (Vercel)
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
}
module.exports = app;