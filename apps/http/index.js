import OpenAI from "openai";
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// ENVIRONMENT CHECK
// ==========================================

console.log(
  "OPENROUTER_API_KEY loaded:",
  !!process.env.OPENROUTER_API_KEY
);

console.log(
  "OPENWEATHER_API_KEY loaded:",
  !!process.env.OPENWEATHER_API_KEY
);

if (!process.env.OPENROUTER_API_KEY) {
  console.error("❌ OPENROUTER_API_KEY is missing.");
  process.exit(1);
}

if (!process.env.OPENWEATHER_API_KEY) {
  console.error("❌ OPENWEATHER_API_KEY is missing.");
  process.exit(1);
}

// ==========================================
// OPENROUTER
// ==========================================

const ai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// ==========================================
// WEATHER ROUTE
// ==========================================

app.get("/weather-ai/:prompt", async (req, res) => {
  try {
    const prompt = decodeURIComponent(req.params.prompt);

    // --------------------------------------
    // Analyze user question
    // --------------------------------------

    const analysis = await ai.chat.completions.create({
      model: "google/gemini-3.8-flash",

      messages: [
        {
          role: "system",
          content: `
You are a weather query analyzer.

Return ONLY valid JSON.

Weather:
{
"isWeather": true,
"city":"Patiala",
"question":"What is the temperature?"
}

Not Weather:
{
"isWeather": false,
"city": null,
"question": null
}
`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],

      max_tokens: 150,
    });

    let analysisText = analysis.choices[0].message.content;

    analysisText = analysisText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(analysisText);

    // --------------------------------------
    // General question
    // --------------------------------------

    if (!parsed.isWeather) {
      const general = await ai.chat.completions.create({
        model: "google/gemini-3.8-flash",

        messages: [
          {
            role: "system",
            content: `
Answer normally.

Then briefly remind the user that you are designed for weather questions.
`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],

        max_tokens: 300,
      });

      return res.json({
        message: general.choices[0].message.content,
      });
    }

    // --------------------------------------
    // No city
    // --------------------------------------

    if (!parsed.city) {
      return res.json({
        message:
          "🌤️ Please tell me which city you're asking about.\n\nExample: *What's the temperature in Patiala?*",
      });
    }

    // --------------------------------------
    // Fetch weather
    // --------------------------------------

    const weatherURL =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?q=${encodeURIComponent(parsed.city)}` +
      `&appid=${process.env.OPENWEATHER_API_KEY}` +
      `&units=metric`;

    const weatherResponse = await fetch(weatherURL);
    const weather = await weatherResponse.json();

    if (!weatherResponse.ok) {
      return res.json({
        message: `🌤️ I couldn't find weather information for **${parsed.city}**.`,
      });
    }

    // --------------------------------------
    // Final AI weather answer
    // --------------------------------------

    const finalResponse = await ai.chat.completions.create({
      model: "google/gemini-3.8-flash",

      messages: [
        {
          role: "system",
          content: `
Use ONLY the provided weather data.

Keep the answer concise.
`,
        },
        {
          role: "user",
          content: `
Original question:
${prompt}

Weather:
${JSON.stringify(weather)}
`,
        },
      ],

      max_tokens: 300,
    });

    return res.json({
      message: finalResponse.choices[0].message.content,
    });
  } catch (error) {
    console.error("Weather AI Error:", error);

    // OpenRouter credit error
    if (error.status === 402) {
      return res.status(402).json({
        message:
          "⚠️ AI service has insufficient OpenRouter credits. Please try again later.",
      });
    }

    // Rate limit
    if (error.status === 429) {
      return res.status(429).json({
        message:
          "⏳ Too many requests. Please wait a moment and try again.",
      });
    }

    return res.status(500).json({
      message: "❌ Something went wrong while processing your request.",
    });
  }
});

// ==========================================
// NORMAL ASK ROUTE
// ==========================================

app.get("/ask/:str", async (req, res) => {
  try {
    const prompt = decodeURIComponent(req.params.str);

    const completion = await ai.chat.completions.create({
      model: "google/gemini-3.8-flash",

      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],

      max_tokens: 500,
    });

    return res.json({
      message: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error("Ask Error:", error);

    if (error.status === 402) {
      return res.status(402).json({
        message:
          "⚠️ AI service has insufficient OpenRouter credits. Please try again later.",
      });
    }

    return res.status(500).json({
      message: "❌ Something went wrong.",
    });
  }
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/hi", (req, res) => {
  res.json({
    message: "Weather AI Backend Running ✅",
  });
});

// ==========================================
// START SERVER
// ==========================================

const PORT = 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌤️ Weather AI server running on http://0.0.0.0:${PORT}`);
});