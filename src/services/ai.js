const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

// Initialize Gemini client if API key is present
const genAI = config.geminiApiKey ? new GoogleGenerativeAI(config.geminiApiKey) : null;

/**
 * Generate AI Text response (Chat / Q&A)
 */
async function generateAiText(prompt, systemInstruction = "You are a helpful AI Assistant on Telegram.") {
  if (!config.geminiApiKey || !genAI) {
    return "⚠️ AI API key is not configured. Please add GEMINI_API_KEY in your .env file.";
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      systemInstruction: systemInstruction
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "No response generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `❌ AI Error: ${error.message || "Something went wrong"}`;
  }
}

/**
 * Summarize text or document content
 */
async function summarizeText(text) {
  const prompt = `Please provide a concise, structured summary with key takeaways from the following text:\n\n${text}`;
  return await generateAiText(prompt, "You are an expert summarizer and analyst.");
}

/**
 * Code assistant / Debugger tool
 */
async function generateCodeHelper(codeOrProblem) {
  const prompt = `Solve or explain the following coding question or code snippet cleanly with explanations:\n\n${codeOrProblem}`;
  return await generateAiText(prompt, "You are a senior software engineer assistant.");
}

module.exports = {
  generateAiText,
  summarizeText,
  generateCodeHelper
};
