import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

// Server-side state (recommended)
const interaction1 = await ai.interactions.create({
  model: "gemini-3.8-flash",
  input: "what is normal function explain me ",
});
console.log("Response 1:", interaction1.output_text);
import dotenv from "dotenv";
