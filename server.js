// server.js — Universal Version for Lisumen Innovative Hub
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
// Vercel/Netlify will provide the PORT; 3000 is for local testing
const PORT = process.env.PORT || 3000;

// Middleware: Support large CV uploads and serve static files from 'public'
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/analyze', async (req, res) => {
  // Check for the key in both standard and Vercel-specific formats
  const API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!API_KEY) {
    console.error("ANALYSIS FAILED: GEMINI_API_KEY is not configured.");
    return res.status(500).json({ 
      error: 'API Key missing. Please set GEMINI_API_KEY in your platform dashboard.' 
    });
  }

  const { cv, jd } = req.body;
  if (!cv || !jd) return res.status(400).json({ error: 'CV and JD are required.' });

  // UPDATED MODEL: gemini-3-flash-preview is the standard for April 2026
  const MODEL_NAME = 'gemini-3-flash-preview';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

  const prompt = `You are a world-class ATS analyst. Analyze this CV against the JD. 
  Return ONLY a valid JSON object: { "score": 0-100, "matched_keywords": [], "missing_keywords": [], "section_scores": [], "strengths": [], "improvements": [] }
  
  CV CONTENT:
  ${cv}
  
  JOB DESCRIPTION:
  ${jd}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("Gemini API Error:", data.error.message);
      return res.status(response.status).json({ error: data.error.message });
    }

    // Extract and clean the JSON from the AI response
    const rawText = data.candidates[0].content.parts[0].text;
    const cleanJson = rawText.replace(/```json|```/g, '').trim();
    
    // Return parsed JSON directly to the frontend
    res.json(JSON.parse(cleanJson));

  } catch (err) {
    console.error("Internal Server Error:", err.message);
    res.status(500).json({ error: 'AI Analysis failed. Please try again.' });
  }
});

// Serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// For serverless platforms like Vercel
module.exports = app;

// For persistent servers like Render/VPS
if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 CVScan AI active on port ${PORT}`));
}
