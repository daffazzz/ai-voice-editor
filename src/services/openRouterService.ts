import type { RenameMode } from '../types';

const OPENROUTER_MODEL = 'tencent/hy3-preview:free';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FALLBACK_MODIFIERS = ['New', 'Deep', 'Soft', 'Wild', 'Late', 'Lost', 'Bright', 'Quiet', 'Slow', 'Golden', 'Electric', 'Hidden'];
const FALLBACK_SUFFIXES = ['Version', 'Feeling', 'Story', 'Memory', 'Echo', 'Signal', 'Dream', 'Motion', 'Scene', 'Moment', 'Shadow', 'Light'];

export async function generateNewTitle(originalTitle: string, mode: RenameMode = 'rewrite'): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn('Missing OPENROUTER_API_KEY. Falling back to local title.');
    return mode === 'clean' ? createCleanFallbackTitle(originalTitle) : createFallbackTitle(originalTitle);
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
            content: mode === 'clean'
              ? 'You detect the real song title from messy YouTube audio filenames for Roblox release metadata. Return only the cleaned core song title, safe for Roblox moderation. Never return an explanation.'
              : 'You rename songs for Roblox release metadata. Return one polished title that clearly relates to the original title, avoids Roblox moderation risk, and does not become generic. Never return an explanation.',
          },
          {
            role: 'user',
            content: mode === 'clean' ? getCleanTitlePrompt(originalTitle) : getRewriteTitlePrompt(originalTitle),
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
    const title = finalizeGeneratedTitle(cleanTitle(data?.choices?.[0]?.message?.content), originalTitle, mode);

    if (!title || isTooSimilarTitle(originalTitle, title)) {
      return mode === 'clean' ? createCleanFallbackTitle(originalTitle) : createFallbackTitle(originalTitle);
    }

    return title;
  } catch (error) {
    console.error('Error generating title with OpenRouter:', error);
    return mode === 'clean' ? createCleanFallbackTitle(originalTitle) : createFallbackTitle(originalTitle);
  }
}

function getRewriteTitlePrompt(originalTitle: string): string {
  return `Rewrite this song title into a genuinely different release title.

Requirements:
- Preserve the meaning, mood, language, and genre context of the original title.
- Prefer a natural variation, alternate phrase, or related image over a vague generic title.
- Keep the new title clearly connected to the original title's theme, feeling, or subject.
- If any wording may conflict with Roblox moderation, replace it with a safer neutral phrase.
- Avoid references to violence, self-harm, terror, hate, drugs, explicit romance, body parts, profanity, sexual wording, or targeted insults.
- Do not force outer-space, moon, planet, galaxy, nebula, orbit, comet, satellite, or cosmic wording unless the original title already has that theme.
- Do not only change capitalization, punctuation, spacing, or word order.
- You may reuse one important original word when needed to keep the title related, but do not return the exact same title.
- Avoid generic words like Horizon, Afterglow, Mirage, Pulse, Drift, Signal, Cascade, Echo unless they genuinely fit the original.
- Make it sound professional and ready for a new release.
- Return only the new title string, 2 to 5 words, Title Case.

Original Title: ${originalTitle}`;
}

function getCleanTitlePrompt(originalTitle: string): string {
  return `Detect the real core song title from this messy YouTube audio filename.

Requirements:
- The input may contain artist names, channel names, uploader names, genre/version tags, hype words, or YouTube noise.
- Return the actual song title only.
- Remove artist, author, channel, uploader, writer, and performer names.
- Remove tags like cover, reggae, slowed, sped up, remix, lyrics, official audio, visualizer, karaoke, live, full album, DJ, version, and bracketed credits.
- If the filename has several dash-separated parts, choose the part that is most likely the song title, not the artist/channel/version tag.
- Example: "Angin - Radja By Shifa Vibes Cover Reggae" -> "Angin".
- Example: "Ed Sheeran - Perfect" -> "Perfect".
- Example: "ENAKKK BANGETTT!!! - BUKIT BERBUNGA COVER REGGAE - REGGAE IN" -> "Bukit Berbunga".
- If the title contains sensitive, explicit, hateful, violent, drug, sexual, or profanity words, replace only those words with safer neutral wording.
- Dating or romance is allowed only when mild. Keep words like "love" when they are neutral, but remove or soften suggestive/personal phrasing such as baby, kiss, touch, your body, your waist, your lips, or similar wording.
- If any wording may conflict with Roblox moderation, replace it with a safer neutral phrase even if the original theme changes slightly.
- Avoid references to self-harm, hanging, death, murder, terror, weapons, hate, drugs, explicit romance, body parts, profanity, sexual wording, or targeted insults.
- Do not invent a completely new theme.
- Return only the cleaned title string, Title Case, 1 to 5 words.

Filename: ${originalTitle}`;
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

function finalizeGeneratedTitle(candidateTitle: string, originalTitle: string, mode: RenameMode): string {
  if (mode !== 'clean') return candidateTitle;

  const cleanedCandidate = createCleanFallbackTitle(candidateTitle || originalTitle);
  const cleanedOriginal = createCleanFallbackTitle(originalTitle);
  const candidateChanged = normalizeTitle(cleanedCandidate) !== normalizeTitle(originalTitle);

  return candidateChanged ? cleanedCandidate : cleanedOriginal;
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

function createCleanFallbackTitle(originalTitle: string): string {
  const withoutExtension = originalTitle.replace(/\.[a-z0-9]+$/i, '');
  const withoutCredits = removeCreditAndVersionText(withoutExtension)
    .replace(/\b(official|audio|lyrics?|visualizer|remix|cover|slowed|sped\s*up|speed\s*up)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const softened = softenSensitiveWords(softenDatingPhrases(withoutCredits || withoutExtension));

  return toTitleCase(softened || createFallbackTitle(originalTitle));
}

function removeCreditAndVersionText(title: string): string {
  const compactTitle = title
    .replace(/\([^)]*(official|audio|lyrics?|remix|cover|feat\.?|ft\.?|prod\.?|visualizer)[^)]*\)/gi, '')
    .replace(/\[[^\]]*(official|audio|lyrics?|remix|cover|feat\.?|ft\.?|prod\.?|visualizer)[^\]]*\]/gi, '')
    .replace(/\s+(feat\.?|ft\.?|prod\.?|by)\s+.+$/i, '')
    .replace(/\s+/g, ' ');

  const hyphenParts = compactTitle.split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  if (hyphenParts.length >= 2) {
    const meaningfulPart = hyphenParts.find(part => looksLikeSongTitleText(part));
    if (meaningfulPart) return meaningfulPart;

    const left = hyphenParts[0];
    const right = hyphenParts.slice(1).join(' ');
    const leftLooksLikeCredit = looksLikeCreditText(left);
    const rightLooksLikeCredit = looksLikeCreditText(right);

    if (rightLooksLikeCredit && !leftLooksLikeCredit) return left;
    if (leftLooksLikeCredit && !rightLooksLikeCredit) return right;
    if (rightLooksLikeCredit) return left;
    return left.length <= right.length ? left : right;
  }

  return compactTitle.trim();
}

function looksLikeCreditText(value: string): boolean {
  const text = value.toLowerCase();
  const creditWords = [
    'by',
    'cover',
    'reggae',
    'slowed',
    'sped up',
    'speed up',
    'remix',
    'lyrics',
    'official',
    'audio',
    'visualizer',
    'vibes',
    'sand the beach',
    'shifa',
    'feat',
    'ft',
    'prod',
  ];

  return creditWords.some(word => text.includes(word));
}

function looksLikeSongTitleText(value: string): boolean {
  const text = value.toLowerCase();
  const normalizedWords = text.match(/[a-z0-9]+/gi) || [];

  if (looksLikeCreditText(value)) return false;
  if (normalizedWords.length === 0 || normalizedWords.length > 5) return false;
  if (/!{2,}|mantap|enak+k*|banget+t*|viral|terbaru|full|mp3|video|music/i.test(text)) return false;

  return normalizedWords.some(word => word.length > 3);
}

function softenSensitiveWords(title: string): string {
  const replacements: Record<string, string> = {
    gantung: 'Menunggu',
    menggantung: 'Tertahan',
    bunuh: 'Hilang',
    membunuh: 'Menghilang',
    mati: 'Pergi',
    kematian: 'Akhir',
    darah: 'Luka',
    racun: 'Bayang',
    hancur: 'Retak',
    benci: 'Luka',
    teror: 'Gelap',
    terror: 'Dark',
    terrorist: 'Shadow',
    terrorism: 'Darkness',
    weapon: 'Tool',
    weapons: 'Tools',
    gun: 'Beat',
    guns: 'Beats',
    pistol: 'Beat',
    knife: 'Edge',
    knives: 'Edges',
    bomb: 'Drop',
    bombs: 'Drops',
    suicide: 'Goodbye',
    selfharm: 'Pain',
    gore: 'Scene',
    blood: 'Luka',
    bloody: 'Luka',
    kill: 'Stop',
    killer: 'Shadow',
    murder: 'Trouble',
    dead: 'Lost',
    death: 'Ending',
    hate: 'Pain',
    racist: 'Rude',
    racism: 'Rude',
    bully: 'Trouble',
    bullying: 'Trouble',
    insult: 'Words',
    drug: 'Rush',
    drugs: 'Rush',
    weed: 'Green',
    alcohol: 'Drink',
    drunk: 'Dizzy',
    sex: 'Love',
    sexy: 'Sweet',
    baby: 'Dear',
    babe: 'Dear',
    kiss: 'Miss',
    kissing: 'Missing',
    touch: 'Feel',
    touching: 'Feeling',
    lips: 'Smile',
    lip: 'Smile',
    body: 'Heart',
    waist: 'Dance',
    bed: 'Dream',
    naked: 'Open',
    nude: 'Plain',
    hot: 'Bright',
    fuck: 'Forget',
    shit: 'Mess',
    bitch: 'Girl',
    ass: 'Back',
  };

  return title.replace(/\b[a-z]+\b/gi, word => replacements[word.toLowerCase()] || word);
}

function softenDatingPhrases(title: string): string {
  return title
    .replace(/\byour\s+(body|waist|lips?|skin|touch|kiss|bed)\b/gi, 'your heart')
    .replace(/\bi\s+love\s+your\s+what\b/gi, 'I Love Your Heart')
    .replace(/\bbaby\s+i\s+love\s+your\b/gi, 'Dear I Love Your')
    .replace(/\bcome\s+to\s+me\b/gi, 'Stay With Me')
    .replace(/\bhold\s+me\s+tight\b/gi, 'Hold This Feeling');
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

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}
