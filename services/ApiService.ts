import { GoogleGenAI } from "@google/genai";

// --- AI Client Initialization ---
let ai: GoogleGenAI | null = null;

export const initializeAi = (apiKey: string) => {
  if (!apiKey) {
    throw new Error("An API key is required to initialize the AI service.");
  }
  ai = new GoogleGenAI({ apiKey });
};

export const getAi = (): GoogleGenAI => {
  if (!ai) {
    if (process.env.API_KEY) {
      initializeAi(process.env.API_KEY);
      return ai!;
    }
    throw new Error("Gemini AI client has not been initialized. Please provide an API key.");
  }
  return ai;
};


export type ImageService = 'gemini' | 'pollinations';

export const generateImage = async (prompt: string, service: ImageService = 'pollinations'): Promise<string> => {
  prompt = prompt + " Don't add any additional effects or styles";
  if (service === 'pollinations') {
    try {
      const encodedPrompt = encodeURIComponent(prompt);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=flux`;
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to generate image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = Array.from(uint8Array).map((byte) => String.fromCharCode(byte)).join('');
      const base64 = btoa(binaryString);
      return base64;
    } catch (error) {
      console.error("Error in generateImage:", error);
      throw new Error("Failed to generate image. Please check your prompt or internet connection.");
    }
  } else if (service === 'gemini') {
    try {
      const gemini = getAi();
      const response = await gemini.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
      });

      if (!response.generatedImages || response.generatedImages.length === 0 || !response.generatedImages[0].image.imageBytes) {
        throw new Error('No image returned from Gemini');
      }

      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return base64ImageBytes;
    } catch (error) {
      console.error("Error in generateImage (Gemini):", error);
      throw new Error("Failed to generate image with Gemini.");
    }
  } else {
    throw new Error('Unknown image service selected');
  }
};

/**
 * Fetches an image from a local URL and returns it as a blob URL.
 * This is useful for ensuring images are loaded and displayed correctly
 * when relative paths might be problematic.
 * @param url The local URL of the image (e.g., '/challenges/challenge-1.jpg')
 * @returns A promise that resolves to a blob URL (e.g., 'blob:http://...')
 */
export const getLocalImageAsBlobUrl = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${url}. Status: ${response.statusText}`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error(`Error fetching local image ${url}:`, error);
    // Fallback to the original URL if fetching fails, allowing the browser to try and load it directly.
    return url;
  }
};