"use client";

import ReactMarkdown from "react-markdown";
import axios from "axios";
import "./app.css";
import { useState, ChangeEvent, KeyboardEvent } from "react";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [res, setRes] = useState<{ message?: string }>({});
  const [send, setSend] = useState(false);

  // -----------------------------
  // Input change
  // -----------------------------

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPrompt(e.target.value);
  };

  // -----------------------------
  // Send request
  // -----------------------------

  const handleSubmit = async () => {
    if (!prompt.trim() || send) return;

    try {

        setSend(true);
        setRes({});

        const response = await axios.get(
            `http://localhost:3001/weather-ai/${encodeURIComponent(prompt)}`
        );

        setRes(response.data);

    } catch (error) {

        console.error(error);

        setRes({
            message: "❌ Something went wrong."
        });

    } finally {

        setSend(false);

    }
};

  // -----------------------------
  // Enter key
  // -----------------------------

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  // -----------------------------
  // UI
  // -----------------------------

  return (
    <div className="app">

      <div className="weather-card">

        {/* Header */}
        <div className="header">

          <div className="logo">
            🌤️
          </div>

          <div>
            <h1>Weather AI</h1>

            <p>
              Ask anything about the weather
            </p>
          </div>

        </div>

        {/* Search */}
        <div className="search-box">

          <input
            id="hello"
            type="text"
            placeholder="Ask something... e.g. What is the weather in Patiala?"
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            value={prompt}
            disabled={send}
          />

          <button
            onClick={handleSubmit}
            disabled={send || !prompt.trim()}
          >

            {send ? (
              <>
                <span>Thinking</span>
                <span>...</span>
              </>
            ) : (
              <>
                <span>Send</span>
                <span>➜</span>
              </>
            )}

          </button>

        </div>

        {/* Response */}
        {(res?.message || send) && (

          <div className="response-card">

            {/* Response Header */}
            <div className="response-header">

              <span className="response-icon">
                🤖
              </span>

              <span>
                AI Response
              </span>

            </div>

            {/* Response Content */}
            <div className="response-content">

              {send ? (

                <div className="loading">

                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>

                  <span>
                    Getting the latest weather...
                  </span>

                </div>

              ) : (

                <ReactMarkdown>
                  {
                    typeof res?.message === "string"
                      ? res.message
                      : JSON.stringify(
                          res?.message ?? "",
                          null,
                          2
                        )
                  }
                </ReactMarkdown>

              )}

            </div>

          </div>

        )}

      </div>

    </div>
  );
}
