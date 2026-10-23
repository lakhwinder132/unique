export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 12000;

export function prepareConversation(input: unknown, prompt: string): ConversationMessage[] {
  const supplied = Array.isArray(input)
    ? input.flatMap((item): ConversationMessage[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const message = item as Record<string, unknown>;
      if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") return [];
      return [{ role: message.role, content: message.content.slice(0, 4000) }];
    })
    : [];
  const withCurrent = supplied.at(-1)?.role === "user" && supplied.at(-1)?.content === prompt
    ? supplied
    : [...supplied, { role: "user" as const, content: prompt }];

  const bounded: ConversationMessage[] = [];
  let chars = 0;
  for (const message of withCurrent.slice(-MAX_HISTORY_MESSAGES).reverse()) {
    if (chars + message.content.length > MAX_HISTORY_CHARS) continue;
    bounded.unshift(message);
    chars += message.content.length;
  }
  return bounded;
}

export function buildRetrievalQuestion(history: ConversationMessage[], prompt: string) {
  if (history.length < 2 || prompt.length >= 160) return prompt;
  const context = history.slice(0, -1).slice(-4)
    .map(({ role, content }) => `${role}: ${content}`)
    .join("\n")
    .slice(-1200);
  return `${context}\nFarmer's latest question: ${prompt}`;
}
