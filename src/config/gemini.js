const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('Missing Gemini API key. Please check your environment variables.');
}

const genAI = new GoogleGenerativeAI(apiKey);

// Initialize models
const models = {
  flash: genAI.getGenerativeModel({ model: "gemini-2.0-flash" }),
  pro: genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
};

module.exports = { genAI, models }; 