export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.GOOGLE_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Google API key not configured' });
  }

  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const model = process.env.IMAGE_MODEL || 'gemini-2.0-flash-exp';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Google API error' });
    }

    // Extract image from response
    let imageData = null;
    let textResponse = '';

    if (data.candidates?.[0]) {
      const candidate = data.candidates[0];

      if (candidate.finishReason === 'SAFETY') {
        return res.status(400).json({ error: 'Image generation blocked by safety filters' });
      }
      if (candidate.finishReason === 'RECITATION') {
        return res.status(400).json({ error: 'Generation blocked due to recitation policy' });
      }

      for (const part of candidate.content?.parts || []) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          imageData = part.inlineData.data;
          break;
        }
        if (part.text) textResponse += part.text;
      }
    }

    if (data.promptFeedback?.blockReason) {
      return res.status(400).json({ error: `Prompt blocked: ${data.promptFeedback.blockReason}` });
    }

    if (imageData) {
      return res.status(200).json({ image: imageData });
    }

    return res.status(400).json({
      error: textResponse
        ? 'Model returned text instead of image: ' + textResponse.substring(0, 100)
        : 'No image in response',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
