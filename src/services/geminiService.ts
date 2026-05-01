import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateNewTitle(originalTitle: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a creative music metadata specialist. Given a song title or filename, generate a new artistic and catchy title that preserves the 'vibe' and 'mood' of the original but uses completely different words to avoid duplicate detection. 
      
      Requirements:
      - Preserve the genre context (e.g. if it's lo-fi, keep the title chill).
      - Do NOT use common duplicate words from the original if possible.
      - Make it sound professional and ready for a new release.
      - Return ONLY the new title string without any explanation or quotes.
      
      Original Title: ${originalTitle}`,
    });

    return response.text || originalTitle;
  } catch (error) {
    console.error("Error generating title:", error);
    return `Morphed - ${originalTitle}`;
  }
}
