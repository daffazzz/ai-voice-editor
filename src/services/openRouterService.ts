const OPENROUTER_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function generateNewTitle(originalTitle: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn('Missing OPENROUTER_API_KEY. Falling back to local title.');
    return `Morphed - ${originalTitle}`;
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'SonicMorph AI',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a creative music metadata specialist. Return only one polished song title, without quotes or explanation.',
          },
          {
            role: 'user',
            content: `Given a song title or filename, generate a new artistic and catchy title that preserves the vibe and mood of the original but uses different words to avoid duplicate detection.

Requirements:
- Preserve the genre context, such as keeping lo-fi titles chill.
- Do not use common duplicate words from the original if possible.
- Make it sound professional and ready for a new release.
- Return only the new title string.

Original Title: ${originalTitle}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 40,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status}`);
    }

    const data = await response.json();
    const title = data?.choices?.[0]?.message?.content?.trim();

    return title || originalTitle;
  } catch (error) {
    console.error('Error generating title with OpenRouter:', error);
    return `Morphed - ${originalTitle}`;
  }
}
