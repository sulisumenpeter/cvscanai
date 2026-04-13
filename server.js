require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/analyze', async (req, res) => {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'API Key missing' });

  const { cv, jd } = req.body;
  const prompt = `Analyze this CV against the JD. Return ONLY valid JSON: { "score": 85, "matched_keywords": ["react", "node"], "missing_keywords": ["aws"], "section_scores": [], "strengths": ["Clear formatting"], "improvements": ["Add metrics"] } \n\nCV: ${cv} \n\nJD: ${jd}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    
    // Check if Gemini returned an error
    if (data.error) throw new Error(data.error.message);

    const rawText = data.candidates[0].content.parts[0].text;
    const cleanJson = rawText.replace(/```json|```/g, '').trim();
    
    // We send back the actual parsed object to the frontend
    res.json(JSON.parse(cleanJson)); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}
module.exports = app;
