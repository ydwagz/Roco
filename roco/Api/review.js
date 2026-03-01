import fetch from 'node-fetch';

export default async function handler(req, res) {
  // only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType, itemType } = req.body;

  if (!imageBase64 || !mimeType || !itemType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['Shirt', 'T-Shirt', 'Pants'].includes(itemType)) {
    return res.status(400).json({ error: 'Invalid itemType' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `You are RoCo's AI clothing critic — a sharp, honest Roblox fashion analyst. Analyze Roblox clothing templates and tell creators how they'd perform on the marketplace. Search for current trends to back your review. Be honest and direct.

Respond ONLY with a single valid JSON object — no markdown, no extra text:
{
  "score": <integer 1-10>,
  "verdict": "<one punchy sentence>",
  "strengths": ["<point>", "<point>"],
  "weaknesses": ["<point>", "<point>"],
  "trend_note": "<what current Roblox fashion trends say about this style>",
  "advice": "<one concrete actionable tip>"
}`,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
            { type: 'text', text: `This is a Roblox ${itemType} template. Search for current Roblox clothing marketplace trends and popular styles in 2025. Analyze this template honestly — design quality, trend alignment, and how it would sell. Be brutally honest.` }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: errData?.error?.message || `Anthropic error ${response.status}` });
    }

    const data = await response.json();
    const raw = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');

    let result;
    try {
      result = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch (e) {
      const match = raw.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : null;
    }

    if (!result) return res.status(500).json({ error: 'Could not parse AI response' });

    res.json(result);

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
