import { GoogleGenAI, Type, ThinkingLevel, Modality } from "@google/genai";
import { useStore } from "../store/useStore";

export const getGeminiClient = () => {
  // Try to get key from store first (admin-configured key)
  const storeKey = useStore.getState().brandSettings.geminiApiKey;
  
  // Fallback to environment variables
  const apiKey = storeKey || process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Please add it to your environment variables or system configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateStory = async (params: {
  theme: string;
  characterName: string;
  age: string;
  moral: string;
  pages: number;
  language: string;
}) => {
  const ai = getGeminiClient();
  const prompt = `Create a children's storybook outline and content.
  Theme: ${params.theme}
  Main Character: ${params.characterName}
  Target Age: ${params.age}
  Moral Value: ${params.moral}
  Number of Pages: ${params.pages}
  Language: ${params.language}

  Format the output as a JSON object with:
  - title: string
  - characterDescription: string (detailed physical description of the main character to ensure consistency across all images)
  - coverPrompt: string (detailed description for image generation, including the character and setting)
  - pages: array of { pageNumber: number, content: string, illustrationPrompt: string }
  
  Make the story engaging, age-appropriate, and ensure character consistency.
  The characterDescription should be very specific about hair color, clothing, and features.
  Each illustrationPrompt MUST start with a reference to the characterDescription.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          characterDescription: { type: Type.STRING },
          coverPrompt: { type: Type.STRING },
          pages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pageNumber: { type: Type.INTEGER },
                content: { type: Type.STRING },
                illustrationPrompt: { type: Type.STRING },
              },
              required: ["pageNumber", "content", "illustrationPrompt"],
            },
          },
        },
        required: ["title", "characterDescription", "coverPrompt", "pages"],
      },
    },
  });

  try {
    let text = response.text;
    if (!text) throw new Error("AI returned empty response");
    
    // Remove markdown code blocks if present
    text = text.replace(/```json\n?|\n?```/g, "").trim();
    
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse AI response:", response.text);
    throw new Error("Gagal memproses format cerita dari AI. Silakan coba lagi.");
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateIllustration = async (prompt: string, retries = 3) => {
  const ai = getGeminiClient();
  const fullPrompt = `Children's book illustration, cute cartoon style, bright colors, Disney-like aesthetic, high quality: ${prompt}`;
  
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: fullPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (err: any) {
      const isRateLimit = err?.message?.includes("429") || err?.status === "RESOURCE_EXHAUSTED";
      if (isRateLimit && i < retries) {
        const waitTime = Math.pow(2, i) * 2000 + Math.random() * 1000;
        console.warn(`Rate limit hit, retrying in ${Math.round(waitTime)}ms... (Attempt ${i + 1}/${retries})`);
        await sleep(waitTime);
        continue;
      }
      throw err;
    }
  }
  return null;
};

export const generateNarration = async (text: string, voice: string = "Kore") => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    return `data:audio/mp3;base64,${base64Audio}`;
  }
  return null;
};
