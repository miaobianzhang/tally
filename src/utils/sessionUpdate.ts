import type { CategoryId, Session } from '../types';

/** Pure read-modify-write used inside the serialized session write queue. */
export function applySessionUpdate(
  sessions: readonly Session[],
  id: string,
  activity: string,
  category: CategoryId,
): Session[] | null {
  const trimmed = activity.trim();
  if (!trimmed) return null;

  const index = sessions.findIndex((session) => session.id === id);
  if (index < 0) return null;

  return sessions.map((session, sessionIndex) =>
    sessionIndex === index
      ? { ...session, activity: trimmed, category }
      : session,
  );
}
