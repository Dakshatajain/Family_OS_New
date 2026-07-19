const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

async function verifyFirebaseUser(req) {
  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!process.env.FIREBASE_WEB_API_KEY) throw new Error('FIREBASE_WEB_API_KEY is not configured in Vercel.');
  if (!token) return false;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(process.env.FIREBASE_WEB_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token })
  });
  if (!response.ok) return false;
  const data = await response.json();
  return Boolean(data?.users?.[0]?.localId);
}

function cleanJson(text) {
  return String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel.' });

  try {
    if (!(await verifyFirebaseUser(req))) return res.status(401).json({ error: 'Please sign in again.' });
    const input = req.body || {};
    const theme = String(input.theme || '').trim().slice(0, 150);
    const ageMonths = Math.min(72, Math.max(1, Number(input.ageMonths) || 18));
    if (!theme) return res.status(400).json({ error: 'Theme is required.' });

    const prompt = `Create exactly 6 safe, play-based toddler activities for age ${ageMonths} months. Theme: ${theme}. Optional focus: color ${input.color || 'any'}, animal ${input.animal || 'any'}, letter ${input.letter || 'any'}, body part ${input.bodyPart || 'any'}, shape ${input.shape || 'any'}, number ${input.number || 'any'}. Use days Monday, Tuesday, Wednesday, Thursday, Friday, Weekend. Return JSON only as {"activities":[{"day":"Monday","time":"Morning","title":"...","desc":"...","materials":"..."}]}. Avoid choking hazards and unsafe materials.`;
    const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.5 }
      })
    });
    const raw = await response.text();
    if (!response.ok) return res.status(502).json({ error: 'Gemini request failed.', details: raw.slice(0, 500) });
    const payload = JSON.parse(raw);
    const text = payload?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    const parsed = JSON.parse(cleanJson(text));
    const activities = (Array.isArray(parsed.activities) ? parsed.activities : []).slice(0, 6).map((a, i) => ({
      day: String(a.day || ['Monday','Tuesday','Wednesday','Thursday','Friday','Weekend'][i]),
      time: String(a.time || 'Morning'),
      title: String(a.title || 'Activity').slice(0, 120),
      desc: String(a.desc || a.description || '').slice(0, 700),
      materials: String(a.materials || 'None').slice(0, 300)
    }));
    if (activities.length !== 6) return res.status(502).json({ error: 'Gemini did not return six activities. Please try again.' });
    return res.status(200).json({ activities });
  } catch (error) {
    console.error('Lesson plan endpoint error:', error?.message || error);
    return res.status(500).json({ error: 'Lesson plan generation failed.' });
  }
}
