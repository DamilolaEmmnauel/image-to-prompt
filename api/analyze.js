export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const { base64, mimeType } = req.body;
    if (!base64 || !mimeType) {
      return res.status(400).json({ error: 'Missing base64 or mimeType' });
    }

    const model = req.body.model || 'gpt-5.2';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
            { type: 'text', text: req.body.prompt },
          ],
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'OpenAI API error' });
    }

    return res.status(200).json({ content: data.choices[0].message.content });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
