import assert from "node:assert/strict";
import test from "node:test";
import { buildRetrievalQuestion, prepareConversation } from "./conversation.ts";

test("keeps ordered user and assistant turns and appends the current question once", () => {
  const history = prepareConversation([
    { role: "user", content: "I grow wheat near Sunam." },
    { role: "assistant", content: "What growth stage is the crop in?" },
  ], "Leaves are yellow. What should I check?");
  assert.deepEqual(history.map(({ role }) => role), ["user", "assistant", "user"]);
  assert.equal(history.at(-1)?.content, "Leaves are yellow. What should I check?");
  assert.match(buildRetrievalQuestion(history, history.at(-1).content), /wheat near Sunam/);
});

test("does not duplicate a current question already present in the request", () => {
  const history = prepareConversation([
    { role: "user", content: "Where is my farm?" },
    { role: "assistant", content: "You said near Sunam." },
    { role: "user", content: "What should I inspect?" },
  ], "What should I inspect?");
  assert.equal(history.length, 3);
});

test("isolates separate conversation inputs and bounds retained context", () => {
  const first = prepareConversation([{ role: "user", content: "Wheat near Sunam" }], "Yellow leaves");
  const second = prepareConversation([], "Paddy in Patiala");
  assert.equal(second.length, 1);
  assert.doesNotMatch(second.map((item) => item.content).join(" "), /Sunam/);
  const large = prepareConversation(Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `${index}: ${"x".repeat(1500)}`,
  })), "current question");
  assert.ok(large.length <= 12);
  assert.ok(large.reduce((total, item) => total + item.content.length, 0) <= 12000);
  assert.equal(first.at(-1)?.content, "Yellow leaves");
});
