"use client";
import "./chatui.css";
import ReactMarkdown from "react-markdown";
import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useRef,
} from "react";

type ChatUIProps = {
  prompt: string;
  response: string;
  send: boolean;

  onPromptChange: (
    e: ChangeEvent<HTMLInputElement>
  ) => void;

  onSubmit: () => void;

  onKeyDown: (
    e: KeyboardEvent<HTMLInputElement>
  ) => void;
};

export default function ChatUI({
  prompt,
  response,
  send,
  onPromptChange,
  onSubmit,
  onKeyDown,
}: ChatUIProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [response]);

  return (
    <div className="chat-app">

      {/* Header */}

      <header className="chat-header">
        <div className="brand">
          <div className="brand-icon">
            🌾
          </div>

          <div>
            <h1>Farmer AI</h1>
            <p>Powered by Ollama</p>
          </div>
        </div>
      </header>


      {/* Messages */}

      <main className="chat-messages">

        {!response && !send && (
          <div className="welcome">

            <div className="welcome-icon">
              🌱
            </div>

            <h2>
              How can I help you?
            </h2>

            <p>
              Ask me anything about farming,
              weather, crops, soil or agriculture.
            </p>

          </div>
        )}


        {response && (
          <div className="message user-message">

            <div className="avatar">
              👤
            </div>

            <div className="message-body">
              <div className="message-name">
                You
              </div>

              <div className="message-text">
                {prompt}
              </div>
            </div>

          </div>
        )}


        {(response || send) && (
          <div className="message ai-message">

            <div className="avatar ai-avatar">
              🤖
            </div>

            <div className="message-body">

              <div className="message-name">
                Farmer AI
              </div>

              <div className="message-text">

                {response ? (
                  <ReactMarkdown>
                    {response}
                  </ReactMarkdown>
                ) : (
                  <div className="thinking">

                    <span></span>
                    <span></span>
                    <span></span>

                    <p>
                      Searching and thinking...
                    </p>

                  </div>
                )}

              </div>

            </div>

          </div>
        )}

        <div ref={messagesEndRef} />

      </main>


      {/* Bottom input */}

      <div className="chat-input-area">

        <div className="chat-input-wrapper">

          <input
            type="text"
            placeholder="Ask anything..."
            value={prompt}
            onChange={onPromptChange}
            onKeyDown={onKeyDown}
            disabled={send}
          />

          <button
            onClick={onSubmit}
            disabled={
              send ||
              !prompt.trim()
            }
            aria-label="Send message"
          >
            {send ? "..." : "➤"}
          </button>

        </div>

        <p className="input-hint">
          Farmer AI can make mistakes. Check
          important agricultural information.
        </p>

      </div>

    </div>
  );
}