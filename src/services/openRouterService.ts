const OPENROUTER_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FALLBACK_ADJECTIVES = ['Lunar', 'Stellar', 'Cosmic', 'Nebula', 'Orbital', 'Solar', 'Astral', 'Galactic'];
const FALLBACK_NOUNS = ['Afterglow', 'Mirage', 'Horizon', 'Pulse', 'Drift', 'Signal', 'Cascade', 'Echo'];

export async function generateNewTitle(originalTitle: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const forbiddenWords = getMeaningfulWords(originalTitle);

  if (!apiKey) {
    console.warn('Missing OPENROUTER_API_KEY. Falling back to local title.');
    return createFallbackTitle(originalTitle);
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
            content: 'You are a creative music metadata specialist. Return only one new polished song title with a clear outer-space theme. Never return the same title, a case-only change, or an explanation.',
          },
          {
            role: 'user',
            content: `Rewrite this song title into a genuinely different release title.

Requirements:
- Preserve the genre context, such as keeping lo-fi titles chill, while making the title clearly related to outer space.
- Use a fresh metaphor or image, not a direct synonym swap.
- Use space imagery such as stars, moons, planets, galaxies, nebulae, orbit, comets, satellites, or cosmic light.
- Do not only change capitalization, punctuation, spacing, or word order.
- Do not include these original words: ${forbiddenWords.join(', ') || '(none)'}.
- Make it sound professional and ready for a new release.
- Return only the new title string, 2 to 5 words, Title Case.

Original Title: ${originalTitle}`,
          },
        ],
        temperature: 1,
        max_tokens: 80,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status}`);
    }

    const data = await response.json();
    const title = cleanTitle(data?.choices?.[0]?.message?.content);

    if (!title || isTooSimilarTitle(originalTitle, title)) {
      return createFallbackTitle(originalTitle);
    }

    return title;
  } catch (error) {
    console.error('Error generating title with OpenRouter:', error);
    return createFallbackTitle(originalTitle);
  }
}

function cleanTitle(value: unknown): string {
  if (typeof value !== 'string') return '';

  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .split('\n')
    .map(line => line.replace(/^[-*\d.)\s]+/, '').trim())
    .find(Boolean)
    ?.replace(/^["'`]+|["'`]+$/g, '')
    .trim() || '';
}

function isTooSimilarTitle(originalTitle: string, candidateTitle: string): boolean {
  const original = normalizeTitle(originalTitle);
  const candidate = normalizeTitle(candidateTitle);

  if (!candidate || original === candidate) return true;

  const originalWords = getMeaningfulWords(originalTitle);
  const candidateWords = getMeaningfulWords(candidateTitle);
  const reusedWords = candidateWords.filter(word => originalWords.includes(word));

  return candidateWords.length > 0 && reusedWords.length / candidateWords.length >= 0.5;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getMeaningfulWords(title: string): string[] {
  return normalizeTitle(title)
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['the', 'and', 'for', 'feat', 'ft', 'mix', 'remix', 'edit', 'audio', 'mp3', 'wav'].includes(word));
}

function createFallbackTitle(originalTitle: string): string {
  const seed = [...normalizeTitle(originalTitle)].reduce((total, char) => total + char.charCodeAt(0), 0);
  const adjective = FALLBACK_ADJECTIVES[seed % FALLBACK_ADJECTIVES.length];
  const noun = FALLBACK_NOUNS[Math.floor(seed / FALLBACK_ADJECTIVES.length) % FALLBACK_NOUNS.length];

  return `${adjective} ${noun}`;
}
