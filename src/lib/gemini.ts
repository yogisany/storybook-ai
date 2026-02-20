import OpenAI from "openai";
import { useStore } from "../store/useStore";

/**
 * Groq Client for Story Generation
 */
const getGroqClient = () => {
  const apiKey = useStore.getState().brandSettings.groqApiKey;
  if (!apiKey) {
    throw new Error("Groq API Key belum diatur. Silakan atur di menu Manajemen Admin.");
  }
  
  return new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.groq.com/openai/v1",
    dangerouslyAllowBrowser: true
  });
};

/**
 * Generate Story using Groq (Llama 3)
 */
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

  const groq = getGroqClient();
  
  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: "You are a creative children's book author. Always respond in valid JSON format." },
      { role: "user", content: prompt }
    ],
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" }
  });
  
  const content = completion.choices[0].message.content;
  if (!content) throw new Error("Groq tidak memberikan respon.");
  return JSON.parse(content);
};

/**
 * OpenRouter Client for Image Generation
 */
const getOpenRouterClient = () => {
  const apiKey = useStore.getState().brandSettings.openrouterApiKey;
  if (!apiKey) return null;
  
  return new OpenAI({
    apiKey: apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      "HTTP-Referer": window.location.origin,
      "X-Title": "Kisah Ai",
    }
  });
};

/**
 * Generate Illustration using OpenRouter (Flux or Imagen)
 */
export const generateIllustration = async (prompt: string) => {
  const openrouter = getOpenRouterClient();
  
  if (openrouter) {
    console.log("Mencoba generate gambar via OpenRouter...");
    try {
      const response = await openrouter.images.generate({
        model: "black-forest-labs/flux-schnell", 
        prompt: `Children's book illustration, cute cartoon style, bright colors, Disney-like aesthetic, high quality, consistent character: ${prompt}`,
        n: 1,
        size: "1024x1024",
      });

      if (response.data && response.data[0] && response.data[0].url) {
        console.log("Berhasil generate gambar via OpenRouter");
        return response.data[0].url;
      } else {
        throw new Error("Respon OpenRouter tidak berisi URL gambar.");
      }
    } catch (err: any) {
      console.error("OpenRouter Gagal:", err);
      // Jika error 1033 atau error lainnya, kita log detailnya
      if (err?.status === 403 || err?.status === 401) {
        console.error("Masalah Autentikasi: Cek apakah API Key OpenRouter Anda valid dan memiliki saldo.");
      }
      console.warn("Beralih ke Pollinations.ai sebagai cadangan...");
    }
  } else {
    console.warn("API Key OpenRouter tidak ditemukan, menggunakan Pollinations.ai...");
  }

  // Fallback to Pollinations.ai
  const seed = Math.floor(Math.random() * 1000000);
  const encodedPrompt = encodeURIComponent(`Children's book illustration, cute cartoon style, bright colors, Disney-like aesthetic, high quality, consistent character: ${prompt}`);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`;
};

/**
 * Generate Narration using Browser Speech Synthesis (Free)
 */
export const generateNarration = async (text: string) => {
  return new Promise<string | null>((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID'; // Default to Indonesian
    
    // We don't return a URL for browser TTS, we just play it
    // But to keep the interface consistent, we'll return a dummy string
    window.speechSynthesis.speak(utterance);
    resolve("browser-speech");
  });
};
