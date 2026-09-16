// api/analyze.js
// Standard Vercel Serverless Function

const getSystemPrompt = () => `You are a professional ATS analyzer. Return ONLY a valid JSON object.
Format: {"score": 0, "matched_keywords": [], "missing_keywords": [], "strengths": [], "improvements": []}`;

async function tryGemini(cv, jd) {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) throw new Error("GEMINI_API_KEY is missing");
  
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

module.exports = async function handler(req, res) {
  // CORS Headers if needed
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { cv, jd } = req.body;
    if (!cv || !jd) {
      return res.status(400).json({ error: "CV and JD are required." });
    }

    try {
      console.log("Stage 1: Attempting Gemini...");
      const result = await tryGemini(cv, jd);
      return res.status(200).json(result);
    } catch (err) {
      console.error("Gemini Failed:", err.message);
      
      try {
        console.log("Stage 2: Falling back to Cerebras AI...");
        const result = await tryCerebras(cv, jd);
        return res.status(200).json(result);
      } catch (err2) {
        console.error("Cerebras AI Failed:", err2.message);
        return res.status(503).json({ error: "High traffic. AI engines are currently at capacity or API keys are missing." });
      }
    }
  } catch (globalErr) {
    console.error("Fatal Handler Error:", globalErr);
    return res.status(500).json({ error: "Internal Server Error", details: globalErr.message });
  }
};
