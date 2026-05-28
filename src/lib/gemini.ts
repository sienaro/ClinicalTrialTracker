import { GoogleGenerativeAI } from "@google/generative-ai";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY not configured");
    this.name = "GeminiNotConfiguredError";
  }
}

function getModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

/** Generate plain text from a single prompt. Throws GeminiNotConfiguredError if no key. */
export async function generateText(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getModelName(),
    ...(system ? { systemInstruction: system } : {}),
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/** Generate JSON (responseMimeType: application/json) and parse it. */
export async function generateJson<T>(prompt: string, system?: string): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getModelName(),
    generationConfig: { responseMimeType: "application/json" },
    ...(system ? { systemInstruction: system } : {}),
  });
  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as T;
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
