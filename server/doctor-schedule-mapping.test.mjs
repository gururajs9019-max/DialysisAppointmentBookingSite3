import assert from "node:assert/strict";
import { addLocalDays, localDateKey, sessionsByWeekDate, sessionsForDate, weekDateKeys } from "../src/app/lib/scheduleDateMapping.mjs";

const today = new Date(2025, 5, 18);
const yesterday = localDateKey(addLocalDays(today, -1));
const todayKey = localDateKey(today);
const tomorrow = localDateKey(addLocalDays(today, 1));
const sessions = [
  { id: "yesterday", date: yesterday },
  { id: "today", date: todayKey },
  { id: "tomorrow", date: tomorrow },
  { id: "legacy", date: "Recently" },
];

assert.deepEqual(sessionsForDate(sessions, yesterday).map(s => s.id), ["yesterday"]);
assert.deepEqual(sessionsForDate(sessions, todayKey).map(s => s.id), ["today"]);
assert.deepEqual(sessionsForDate(sessions, tomorrow).map(s => s.id), ["tomorrow"]);
assert.deepEqual(sessionsForDate(sessions, "Recently"), []);

const keys = weekDateKeys(today);
const weekly = sessionsByWeekDate(sessions, keys);
assert.deepEqual(weekly[yesterday].map(s => s.id), ["yesterday"]);
assert.deepEqual(weekly[todayKey].map(s => s.id), ["today"]);
assert.deepEqual(weekly[tomorrow].map(s => s.id), ["tomorrow"]);
assert.equal(Object.values(weekly).flat().some(s => s.id === "legacy"), false);

console.log("doctor schedule date mapping tests passed");