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

function parseServings(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  const source = String(value ?? '').replace(/â€“|â€”/g, '-');
  const nums = source.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(n => Number.isFinite(n) && n > 0) || [];
  if (!nums.length) return 1;
  if (nums.length > 1 && /-|–|—/.test(source)) return (nums[0] + nums[1]) / 2;
  return nums[0];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel.' });

  try {
    if (!(await verifyFirebaseUser(req))) return res.status(401).json({ error: 'Please sign in again.' });
    const ingredients = String(req.body?.ingredients || '').trim();
    const servings = parseServings(req.body?.servings);
    if (!ingredients) return res.status(400).json({ error: 'Ingredients are required.' });
    if (ingredients.length > 12000) return res.status(400).json({ error: 'Ingredients are too long.' });
    if (!Number.isFinite(servings) || servings <= 0 || servings > 100) return res.status(400).json({ error: 'Servings must be between 1 and 100.' });

    const prompt = `Estimate nutrition PER SERVING for this recipe.\n\nIngredients:\n${ingredients}\n\nServings: ${servings}\n\nReturn JSON with numeric fields only: calories, protein, carbs, fat.`;
    const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });
    const raw = await response.text();
    if (!response.ok) return res.status(502).json({ error: 'Gemini request failed.', details: raw.slice(0, 500) });
    const payload = JSON.parse(raw);
    const text = payload?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    const parsed = JSON.parse(cleanJson(text));
    const nutrition = {
      calories: Math.max(0, Number(parsed.calories) || 0),
      protein: Math.max(0, Number(parsed.protein) || 0),
      carbs: Math.max(0, Number(parsed.carbs) || 0),
      fat: Math.max(0, Number(parsed.fat) || 0)
    };
    return res.status(200).json(nutrition);
  } catch (error) {
    console.error('Nutrition endpoint error:', error?.message || error);
    return res.status(500).json({ error: 'Nutrition calculation failed.' });
  }
}
