import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";

// Initialize using environment variable GEMINI_API_KEY
const ai = new GoogleGenAI({});

// Use gemini-2.5-pro or gemini-2.5-flash since we are analyzing media
export async function generateTerminologyFromMedia(mimeType: string, mediaPath: string, language: string = 'zh'): Promise<string[]> {
  const model = 'gemini-2.5-flash';
  
  const promptZh = "作为一名前端或UI设计师，请分析这件设计作品（截图或视频），用精准、专业的中文词语总结它所使用的 5 到 10 个设计模式、UI 元素风格或相关的设计术语。只返回这些词语组成的 JSON 数组格式，不要其他说明。例如: [\"毛玻璃\", \"Hero Section\", \"暗黑模式\", \"微交互\"]";
  const promptEn = "As a frontend or UI designer, please analyze this design work (screenshot or video) and summarize 5 to 10 design patterns, UI element styles, or related design terminology it uses in precise, professional English words. Return only a JSON array format of these words without any other instructions. For example: [\"Glassmorphism\", \"Hero Section\", \"Dark Mode\", \"Micro-interactions\"]";
  const promptText = language === 'en' ? promptEn : promptZh;
  
  try {
    // 1. Upload file using File API
    const uploadResult = await ai.files.upload({
      file: mediaPath,
      config: { mimeType: mimeType },
    });
    
    // 2. Poll until state is ACTIVE (or FAILED)
    let fileState = uploadResult.state;
    // According to GenAI SDK docs, we can poll by retrieving the file repeatedly
    let retryCount = 0;
    while (fileState === 'PROCESSING' && retryCount < 120) {
       await new Promise(r => setTimeout(r, 10000)); // wait 10 seconds
       const fileInfo = await ai.files.get({name: uploadResult.name!});
       fileState = fileInfo.state;
       retryCount++;
    }
    
    if (fileState === 'FAILED') {
      console.error("File processing failed:", uploadResult);
      return [];
    }

    // 3. Generate Content
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { fileUri: uploadResult.uri, mimeType: uploadResult.mimeType || mimeType } },
            { text: promptText }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        },
      }
    });

    // 4. Optionally cleanup the file from user's Gemini account to save quota
    try {
      await ai.files.delete({name: uploadResult.name!});
    } catch(e) {
      console.error("Failed to delete file from Gemini:", e);
    }
    
    if (response.text) {
      const terms: string[] = JSON.parse(response.text);
      return terms;
    }
    return [];
  } catch (err) {
    console.error("Error calling Gemini API:", err);
    return [];
  }
}
