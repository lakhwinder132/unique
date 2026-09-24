"use client";

import {
  useState,
  ChangeEvent,
  KeyboardEvent,
} from "react";

import ChatUI from "./components/ChatUI";

import {
  searchWeb,
  createWebContext,
} from "./services/tavily";

import { askOllama } from "./services/ollama";

import "./app.css";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [send, setSend] = useState(false);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    setPrompt(e.target.value);
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || send) {
      return;
    }

    setSend(true);
    setResponse("");

    try {

      // -------------------------
      // Tavily
      // -------------------------

      const searchResults =
        await searchWeb(prompt);

      const webContext =
        createWebContext(searchResults);


      // -------------------------
      // Ollama
      // -------------------------

      await askOllama({
        prompt,
        webContext,

        onChunk: (text) => {
          setResponse(text);
        },
      });

    } catch (error) {

      console.error(error);

      setResponse(
        "❌ Something went wrong."
      );

    } finally {

      setSend(false);

    }
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>
  ) => {

    if (
      e.key === "Enter" &&
      !send
    ) {
      handleSubmit();
    }
  };

  return (
    <ChatUI
      prompt={prompt}
      response={response}
      send={send}
      onPromptChange={handleChange}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    />
  );
}