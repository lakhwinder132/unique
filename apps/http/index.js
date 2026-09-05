import OpenAI from "openai";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

const app = express();

app.use(cors());
app.use(express.json());


// ==========================================
// OPENROUTER / GEMINI
// ==========================================

const ai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});


// ==========================================
// WEATHER AI ROUTE
// ==========================================

app.get("/weather-ai/:prompt", async (req, res) => {

    try {

        const prompt = decodeURIComponent(req.params.prompt);


        // ==========================================
        // 1. ANALYZE USER QUESTION
        // ==========================================

        const analysis = await ai.chat.completions.create({

            model: "google/gemini-3.8-flash",

            messages: [

                {
                    role: "system",

                    content: `
You are a weather query analyzer.

Your job is to determine whether the user's question
is related to weather.

If the question IS related to weather:

1. Extract the city or location.
2. Understand what the user wants to know.

Return ONLY valid JSON.

Example:

{
  "isWeather": true,
  "city": "Patiala",
  "question": "What is the temperature?"
}

Another example:

{
  "isWeather": true,
  "city": "Mumbai",
  "question": "Will it rain?"
}

If the question is NOT related to weather:

Return:

{
  "isWeather": false,
  "city": null,
  "question": null
}

IMPORTANT:

- Return ONLY JSON.
- Do not use Markdown.
- Do not explain anything.
- Do not add extra text.
`
                },

                {
                    role: "user",
                    content: prompt
                }

            ],

            max_tokens: 300
        });


        // ==========================================
        // 2. CLEAN AI RESPONSE
        // ==========================================

        let analysisText =
            analysis.choices[0].message.content;


        analysisText = analysisText
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();


        // ==========================================
        // 3. CONVERT JSON STRING TO OBJECT
        // ==========================================

        const parsed = JSON.parse(analysisText);


        // ==========================================
        // 4. NON-WEATHER QUESTION
        // ==========================================

        if (!parsed.isWeather) {

            const generalResponse =
                await ai.chat.completions.create({

                    model: "google/gemini-3.8-flash",

                    messages: [

                        {
                            role: "system",

                            content: `
You are a helpful AI assistant that is specially designed
for weather-related questions.

If the user asks a normal general-knowledge question,
answer it normally and correctly.

After answering the question, briefly remind the user that
you are specially designed for weather-related questions.

IMPORTANT:

- Do NOT refuse to answer normal questions.
- Do NOT say "I cannot answer this".
- Do NOT give an error.
- Answer the question first.
- Keep the weather reminder short.
- Use Markdown.
- Do not make the reminder too long.

Example:

User:
What is the capital of Punjab?

Good response:

Chandigarh is the capital of Punjab.

🌤️ I'm specially designed for weather-related questions,
so you can also ask me about temperature, rain, humidity,
wind, or forecasts.
`
                        },

                        {
                            role: "user",
                            content: prompt
                        }

                    ],

                    max_tokens: 500
                });


            const answer =
                generalResponse.choices[0].message.content;


            return res.json({
                message: answer
            });
        }


        // ==========================================
        // 5. WEATHER QUESTION WITHOUT CITY
        // ==========================================

        if (!parsed.city) {

            return res.json({

                message: `
🌤️ I'd be happy to help with the weather.

Could you tell me which city or location you're asking about?

For example:

> What's the temperature in Patiala?
`
            });

        }


        // ==========================================
        // 6. OPENWEATHER API
        // ==========================================

        const weatherURL =
            `https://api.openweathermap.org/data/2.5/weather` +
            `?q=${encodeURIComponent(parsed.city)}` +
            `&appid=${process.env.OPENWEATHER_API_KEY}` +
            `&units=metric`;


        const weatherResponse =
            await fetch(weatherURL);


        const weather =
            await weatherResponse.json();


        // ==========================================
        // 7. CITY NOT FOUND
        // ==========================================

        if (!weatherResponse.ok) {

            return res.json({

                message: `
🌤️ I couldn't find weather information for **${parsed.city}**.

Please check the city name and try again.
`
            });

        }


        // ==========================================
        // 8. GENERATE FINAL WEATHER RESPONSE
        // ==========================================

        const finalResponse =
            await ai.chat.completions.create({

                model: "google/gemini-3.8-flash",

                messages: [

                    {
                        role: "system",

                        content: `
You are a helpful weather assistant.

Answer the user's original question using
the LIVE weather data provided below.

IMPORTANT:

- Use ONLY the provided weather data.
- Do not invent weather information.
- Answer exactly what the user asked.
- If they ask temperature, focus on temperature.
- If they ask humidity, focus on humidity.
- If they ask wind, focus on wind.
- If they ask weather conditions, explain the condition.
- Keep the answer concise.
- Use Markdown.
- You may use weather emojis.
- Make the answer easy to read.
`
                    },

                    {
                        role: "user",

                        content: `
Original user question:

${prompt}


Live weather data:

${JSON.stringify(weather)}
`
                    }

                ],

                max_tokens: 1000
            });


        const answer =
            finalResponse.choices[0].message.content;


        // ==========================================
        // 9. SEND RESPONSE
        // ==========================================

        return res.json({
            message: answer
        });


    } catch (error) {

        console.error("Weather AI Error:", error);


        return res.status(500).json({

            message: `
❌ Something went wrong while processing your request.

Please try again.
`
        });

    }

});


// ==========================================
// NORMAL ASK ROUTE
// ==========================================

app.get("/ask/:str", async (req, res) => {

    try {

        const prompt = decodeURIComponent(req.params.str);


        const completion =
            await ai.chat.completions.create({

                model: "google/gemini-3.8-flash",

                messages: [

                    {
                        role: "user",
                        content: prompt
                    }

                ],

                max_tokens: 1000
            });


        const answer =
            completion.choices[0].message.content;


        return res.json({
            message: answer
        });


    } catch (error) {

        console.error(error);


        return res.status(500).json({

            message: "Something went wrong."

        });

    }

});


// ==========================================
// START SERVER
// ==========================================

const PORT = 3001;

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `🌤️ Weather AI server running on http://0.0.0.0:${PORT}`
    );

});