// api/analyze.js
// Standard Vercel Serverless Function

const getSystemPrompt = () => `You are a professional ATS analyzer. Return ONLY a valid JSON object.
Format: {"score": 0, "matched_keywords": [], "missing_keywords": [], "strengths": [], "improvements": []}`;

// --- PROVIDER 1: GEMINI (Primary) ---
async function tryGemini(cv, jd) {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) throw new Error("GEMINI_API_KEY is missing");
  
  // Using the exact version explicitly requested by the API
  const MODEL = 'gemini-3.6-flash';
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
  if (!data.candidates || !data.candidates[0]) {
    throw new Error("Unexpected Gemini response: " + JSON.stringify(data));
  }
  
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
      model: "llama-3.3-70b",
      messages: [
        { role: "system", content: getSystemPrompt() },
        { role: "user", content: `Analyze CV: ${cv} against JD: ${jd}` }
      ],
      temperature: 0.1
    })
  });
  
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  
  // Safely check if choices exist to prevent the "Cannot read properties of undefined" error
  if (!data.choices || !data.choices[0]) {
     throw new Error("Unexpected Cerebras response: " + JSON.stringify(data));
  }
  
  const rawText = data.choices[0].message.content;
  return JSON.parse(rawText.replace(/```json|```/g, '').trim());
}

// --- RATE LIMITING ---
// Note: In serverless environments, this in-memory map resets when the container spins down. 
// It is sufficient to prevent rapid-fire spam from a single IP on a warm container.
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5; // Max 5 analyzes per 10 mins per IP

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || (now - record.startTime > RATE_LIMIT_WINDOW_MS)) {
    rateLimitMap.set(ip, { count: 1, startTime: now });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
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

  // Extract client IP (Vercel provides this in x-forwarded-for)
  const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown-ip';
  
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: "Too many requests. Please wait a few minutes before analyzing another CV." });
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
        return res.status(503).json({ 
          error: "Analysis failed. AI engines are currently at capacity.", 
          debug: `Gemini Error: ${err.message} | Cerebras Error: ${err2.message}` 
        });
      }
    }
  } catch (globalErr) {
    console.error("Fatal Handler Error:", globalErr);
    return res.status(500).json({ error: "Internal Server Error", details: globalErr.message });
  }
};
