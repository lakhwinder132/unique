
const OLLAMA_URL = `http://52.66.94.185:11434`;
const MODEL = "qwen3:8b";

type OllamaOptions = {
prompt: string;
webContext: string;
onChunk: (text: string) => void;
};

export async function askOllama({
prompt,
webContext,
onChunk,
}: OllamaOptions) {
const result = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",

    headers: {
    "Content-Type": "application/json",
    },

    body: JSON.stringify({
    model: MODEL,

    messages: [
        {
        role: "system",
        content: `
You are a helpful AI assistant.

Use the following web search results to answer the user's question.

Web search results:
${webContext}

Use only relevant information from the search results.
Do not invent information.
`,
        },

        {
        role: "user",
        content: prompt,
        },
    ],

    stream: true,
    think: false,
    }),
});

if (!result.ok) {
    const errorText = await result.text();

    throw new Error(
    `Ollama error ${result.status}: ${errorText}`
    );
}

if (!result.body) {
    throw new Error("Ollama did not return a stream.");
}

const reader = result.body.getReader();
const decoder = new TextDecoder();

let fullResponse = "";

while (true) {
    const { value, done } = await reader.read();

    if (done) {
    break;
    }

    const chunk = decoder.decode(value, {
    stream: true,
    });

    if (!chunk) {
    continue;
    }

    const lines = chunk.split("\n");

    for (const line of lines) {
    if (!line.trim()) {
        continue;
    }

    try {
        const data = JSON.parse(line);

        const content = data?.message?.content;

        if (content) {
        fullResponse += content;

        onChunk(fullResponse);
        }
    } catch {
        console.log("Waiting for next chunk...");
    }
    }
}

return fullResponse;
}