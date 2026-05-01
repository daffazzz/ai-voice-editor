const OPENROUTER_MODEL = 'openai/gpt-oss-120b:free';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FALLBACK_MODIFIERS = ['New', 'Deep', 'Soft', 'Wild', 'Late', 'Lost', 'Bright', 'Quiet', 'Slow', 'Golden', 'Electric', 'Hidden'];
const FALLBACK_SUFFIXES = ['Version', 'Feeling', 'Story', 'Memory', 'Echo', 'Signal', 'Dream', 'Motion', 'Scene', 'Moment', 'Shadow', 'Light'];

export async function generateNewTitle(originalTitle: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

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
            content: 'You rename songs for release metadata. Return one polished title that clearly relates to the original title without becoming generic. Never return an explanation.',
          },
          {
            role: 'user',
            content: `Rewrite this song title into a genuinely different release title.

Requirements:
- Preserve the meaning, mood, language, and genre context of the original title.
- Prefer a natural variation, alternate phrase, or related image over a vague generic title.
- Keep the new title clearly connected to the original title's theme, feeling, or subject.
- Do not force outer-space, moon, planet, galaxy, nebula, orbit, comet, satellite, or cosmic wording unless the original title already has that theme.
- Do not only change capitalization, punctuation, spacing, or word order.
- You may reuse one important original word when needed to keep the title related, but do not return the exact same title.
- Avoid generic words like Horizon, Afterglow, Mirage, Pulse, Drift, Signal, Cascade, Echo unless they genuinely fit the original.
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
  if (candidate.includes('horizon') && !original.includes('horizon')) return true;

  const reusedWords = candidateWords.filter(word => originalWords.includes(word));

  return candidateWords.length > 1 && reusedWords.length === candidateWords.length;
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
  const seed = getSeed(originalTitle);
  const meaningfulWords = getMeaningfulWords(originalTitle);
  const anchor = meaningfulWords[seed % Math.max(1, meaningfulWords.length)];
  const titleAnchor = anchor ? toTitleWord(anchor) : 'Song';
  const modifier = FALLBACK_MODIFIERS[seed % FALLBACK_MODIFIERS.length];
  const suffix = FALLBACK_SUFFIXES[Math.floor(seed / FALLBACK_MODIFIERS.length) % FALLBACK_SUFFIXES.length];

  if (anchor) {
    return seed % 2 === 0 ? `${modifier} ${titleAnchor}` : `${titleAnchor} ${suffix}`;
  }

  return `${modifier} ${suffix}`;
}

function getSeed(value: string): number {
  return [...normalizeTitle(value)].reduce((total, char) => total + char.charCodeAt(0), 0);
}

function toTitleWord(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
