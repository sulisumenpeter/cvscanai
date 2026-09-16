const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

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
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });

  const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown-ip';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: "Rate limit exceeded. Please wait a few minutes." });
  }

  try {
    const { cv, jd } = req.body;
    if (!cv || !jd) return res.status(400).json({ error: "CV and Job Description are required." });
    if (cv.length > 100000 || jd.length > 100000) return res.status(400).json({ error: "Payload too large." });

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: "API Key missing." });

    const prompt = `You are an expert technical recruiter and hiring manager. 
Based on the candidate's CV and the target Job Description, generate a list of 6 highly relevant interview questions.
Include 2 Technical questions, 2 Behavioral questions, and 2 Role-specific questions.
Return ONLY a raw JSON object with this exact structure, no markdown formatting, no backticks:
{
  "technical": ["Q1", "Q2"],
  "behavioral": ["Q1", "Q2"],
  "role_specific": ["Q1", "Q2"]
}`;

    // Note: Falling back to standard model in case of 3.6 limits, but using primary first.
    // Try primary
    let url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${API_KEY}`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${prompt}\n\nCV:\n${cv}\n\nJob Description:\n${jd}` }] }],
        generationConfig: { temperature: 0.2, topK: 1 }
      })
    });

    let data = await response.json();
    if (data.error && data.error.code === 503) {
      // Fallback
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-pro:generateContent?key=${API_KEY}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt}\n\nCV:\n${cv}\n\nJob Description:\n${jd}` }] }],
          generationConfig: { temperature: 0.2, topK: 1 }
        })
      });
      data = await response.json();
    }

    if (data.error) throw new Error(data.error.message);
    
    const rawText = data.candidates[0].content.parts[0].text;
    const parsedData = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    
    return res.status(200).json(parsedData);
  } catch (err) {
    console.error("Interview API Error:", err.message);
    return res.status(500).json({ error: "Failed to generate interview questions.", debug: err.message });
  }
};
