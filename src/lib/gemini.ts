import { GoogleGenAI, Type, ThinkingLevel, Modality } from "@google/genai";
import { useStore } from "../store/useStore";

export const getGeminiClients = () => {
  // Get keys from store (newline or comma separated)
  const storeKeysStr = useStore.getState().brandSettings.geminiApiKeys || "";
  const storeKeys = storeKeysStr
    .split(/[\n,]/)
    .map(k => k.trim())
    .filter(k => k.length > 0);
  
  // Fallback to environment variables
  const envKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  
  const allKeys = [...storeKeys];
  if (envKey && !allKeys.includes(envKey)) {
    allKeys.push(envKey);
  }

  if (allKeys.length === 0) {
    throw new Error("GEMINI_API_KEY is not set. Please add it to your environment variables or system configuration.");
  }
  
  return allKeys.map(apiKey => new GoogleGenAI({ apiKey }));
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper to call Gemini with automatic key rotation on 429 errors
 */
async function callWithRotation<T>(
  operation: (ai: GoogleGenAI) => Promise<T>,
  retriesPerKey = 1
): Promise<T> {
  const clients = getGeminiClients();
  let lastError: any = null;

  for (let clientIdx = 0; clientIdx < clients.length; clientIdx++) {
    const ai = clients[clientIdx];
    
    for (let attempt = 0; attempt <= retriesPerKey; attempt++) {
      try {
        return await operation(ai);
      } catch (err: any) {
        lastError = err;
        const isRateLimit = err?.message?.includes("429") || err?.status === "RESOURCE_EXHAUSTED";
        
        if (isRateLimit) {
          if (attempt < retriesPerKey) {
            // Retry with same key after a short delay
            const waitTime = 2000 * (attempt + 1);
            console.warn(`Rate limit on key ${clientIdx + 1}, retrying same key in ${waitTime}ms...`);
            await sleep(waitTime);
            continue;
          } else if (clientIdx < clients.length - 1) {
            // Switch to next key
            console.warn(`Key ${clientIdx + 1} exhausted, rotating to key ${clientIdx + 2}...`);
            break; // Break inner loop to try next client
          }
        }
        // If not a rate limit, or no more retries/keys, throw immediately
        throw err;
      }
    }
  }
  throw lastError || new Error("All API keys exhausted or failed.");
}

export const generateStory = async (params: {
  theme: string;
  characterName: string;
  age: string;
  moral: string;
  pages: number;
  language: string;
}) => {
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

  const response = await callWithRotation((ai) => 
    ai.models.generateContent({
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
    })
  );

  try {
    const text = response.text;
    if (!text) throw new Error("AI returned empty response");
    
    // Clean the text more thoroughly
    const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
    
    // Find the first '{' and last '}' to handle potential extra text from AI
    const startIdx = cleanText.indexOf('{');
    const endIdx = cleanText.lastIndexOf('}');
    
    if (startIdx === -1 || endIdx === -1) {
      throw new Error("Format JSON tidak valid dalam respon AI");
    }
    
    const jsonStr = cleanText.substring(startIdx, endIdx + 1);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("Failed to parse AI response:", response.text);
    throw new Error("Gagal memproses format cerita dari AI. Silakan coba lagi.");
  }
};

export const generateIllustration = async (prompt: string) => {
  const fullPrompt = `Children's book illustration, cute cartoon style, bright colors, Disney-like aesthetic, high quality: ${prompt}`;
  
  return await callWithRotation(async (ai) => {
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
  }, 2); // Allow 2 retries per key for images
};

export const generateNarration = async (text: string, voice: string = "Kore") => {
  return await callWithRotation((ai) => 
    ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    })
  ).then(response => {
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return `data:audio/mp3;base64,${base64Audio}`;
    }
    return null;
  });
};
