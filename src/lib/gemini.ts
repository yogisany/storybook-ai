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
 * Generate Illustration using Freepik API
 */
export const generateIllustration = async (prompt: string) => {
  const freepikKey = useStore.getState().brandSettings.freepikApiKey;
  
  if (freepikKey) {
    console.log("Mencoba generate gambar via Freepik...");
    try {
      const response = await fetch("https://api.freepik.com/v1/ai/text-to-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "x-freepik-api-key": freepikKey
        },
        body: JSON.stringify({
          prompt: `Children's book illustration, cute cartoon style, bright colors, Disney-like aesthetic, high quality, consistent character: ${prompt}`,
          num_images: 1,
          image: {
            size: "square_1024"
          },
          styling: {
            style: "cartoon"
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Freepik API Error: ${response.status}`);
      }

      const data = await response.json();
      // Freepik usually returns an array of images with base64 or URL
      // Based on their typical response structure:
      if (data.data && data.data[0] && data.data[0].base64) {
        console.log("Berhasil generate gambar via Freepik (Base64)");
        return `data:image/png;base64,${data.data[0].base64}`;
      } else if (data.data && data.data[0] && data.data[0].url) {
        console.log("Berhasil generate gambar via Freepik (URL)");
        return data.data[0].url;
      } else {
        throw new Error("Respon Freepik tidak berisi data gambar.");
      }
    } catch (err: any) {
      console.error("Freepik Gagal:", err);
      console.warn("Beralih ke Pollinations.ai sebagai cadangan...");
    }
  } else {
    console.warn("API Key Freepik tidak ditemukan, menggunakan Pollinations.ai...");
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
