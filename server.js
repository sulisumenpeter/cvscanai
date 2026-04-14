// server.js — Optimized for Consistency | Sulisumen Peter
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/analyze', async (req, res) => {
  const API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!API_KEY) {
    console.error("ANALYSIS FAILED: Missing API Key.");
    return res.status(500).json({ error: 'API Key missing in environment settings.' });
  }

  const { cv, jd } = req.body;
  if (!cv || !jd) return res.status(400).json({ error: 'CV and JD are required.' });

  // Current stable model for 2026
  const MODEL_NAME = 'gemini-3-flash-preview';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

  // Strict prompt logic to enforce scoring consistency
  const prompt = `You are a professional ATS (Applicant Tracking System) simulation engine. 
  Your task is to analyze the provided CV against the Job Description (JD) with mathematical precision.

  SCORING RUBRIC:
  - 40% Technical Skill Match (Keywords)
  - 30% Experience Relevance
  - 20% Education & Certifications
  - 10% Formatting & Clarity

  OUTPUT FORMAT:
  Return ONLY a valid JSON object. Do not include conversational text.
  {
    "score": (number 0-100),
    "matched_keywords": ["skill1", "skill2"],
    "missing_keywords": ["skill3"],
    "section_scores": [
       {"section": "Technical Skills", "score": 0},
       {"section": "Experience", "score": 0},
       {"section": "Education", "score": 0}
    ],
    "strengths": ["point1"],
    "improvements": ["action1"]
  }

  CV: ${cv}
  JD: ${jd}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // STABILIZATION CONFIGURATION
        generationConfig: { 
          temperature: 0.1, // Minimizes randomness
          topP: 0.1,        // Focuses on high-probability tokens
          topK: 1,          // Forces the most likely prediction
          maxOutputTokens: 2048
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(response.status).json({ error: data.error.message });
    }

    const rawText = data.candidates[0].content.parts[0].text;
    const cleanJson = rawText.replace(/```json|```/g, '').trim();
    
    res.json(JSON.parse(cleanJson));

  } catch (err) {
    console.error("Internal Server Error:", err.message);
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
