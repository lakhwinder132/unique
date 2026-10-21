import assert from "node:assert/strict";
import test from "node:test";
import { getHomeOccasion, getIndiaDateKey } from "./home-calendar.ts";

test("uses the Indian calendar date even when UTC is still the previous day", () => {
  const date = new Date("2026-01-25T20:00:00.000Z");
  assert.equal(getIndiaDateKey(date), "2026-01-26");
  assert.equal(getHomeOccasion(date)?.name.en, "Republic Day");
});

test("identifies Lohri as an observance rather than an official holiday", () => {
  const occasion = getHomeOccasion(new Date("2026-01-13T06:30:00.000Z"));
  assert.equal(occasion?.kind, "observance");
  assert.equal(occasion?.name.en, "Lohri");
});

test("does not claim an unlisted date is a holiday", () => {
  assert.equal(getHomeOccasion(new Date("2026-02-10T06:30:00.000Z")), null);
});

test("handles invalid dates without returning a holiday", () => {
  const date = new Date(Number.NaN);
  assert.equal(getIndiaDateKey(date), "");
  assert.equal(getHomeOccasion(date), null);
});
