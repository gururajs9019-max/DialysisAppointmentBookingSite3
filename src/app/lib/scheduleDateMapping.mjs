const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateKey(value) {
  return typeof value === "string" && ISO_DATE.test(value);
}

export function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addLocalDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function weekDateKeys(anchorDate) {
  const mondayOffset = (anchorDate.getDay() + 6) % 7;
  const monday = addLocalDays(anchorDate, -mondayOffset);
  return Array.from({ length: 7 }, (_, index) => localDateKey(addLocalDays(monday, index)));
}

export function sessionsForDate(sessions, dateKey) {
  if (!isIsoDateKey(dateKey)) return [];
  return sessions.filter(session => isIsoDateKey(session.date) && session.date === dateKey);
}

export function sessionsByWeekDate(sessions, dateKeys) {
  const mapped = Object.fromEntries(dateKeys.map(key => [key, []]));
  for (const session of sessions) {
    if (isIsoDateKey(session.date) && Object.hasOwn(mapped, session.date)) mapped[session.date].push(session);
  }
  return mapped;
}