import { Timestamp } from 'firebase/firestore';

const ONLINE_GRACE_PERIOD_MS = 90 * 1000;

export const toOptionalIsoDate = (value: unknown): string | null => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (
    typeof value === 'object'
    && value !== null
    && 'toDate' in value
    && typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  if (
    typeof value === 'object'
    && value !== null
    && 'seconds' in value
    && typeof (value as { seconds?: unknown }).seconds === 'number'
  ) {
    const timestampLike = value as { seconds: number; nanoseconds?: unknown };
    const seconds = timestampLike.seconds;
    const nanoseconds = typeof timestampLike.nanoseconds === 'number'
      ? timestampLike.nanoseconds
      : 0;
    const date = new Date(seconds * 1000 + Math.floor(nanoseconds / 1_000_000));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }
  }

  return null;
};

export const isUserOnline = (isOnlineFlag?: boolean, lastSeenAt?: string | null, nowMs = Date.now()): boolean => {
  if (!lastSeenAt) {
    return Boolean(isOnlineFlag);
  }

  const parsedDate = new Date(lastSeenAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return Boolean(isOnlineFlag);
  }

  const isRecentlyActive = nowMs - parsedDate.getTime() <= ONLINE_GRACE_PERIOD_MS;

  // If online flag got stale (e.g. abrupt app/tab close), fall back to recent activity window.
  if (isOnlineFlag) {
    return nowMs - parsedDate.getTime() <= ONLINE_GRACE_PERIOD_MS * 2;
  }

  return isRecentlyActive;
};

export const getPresenceLabel = (isOnlineFlag?: boolean, lastSeenAt?: string | null, nowMs = Date.now()): string => {
  const online = isUserOnline(isOnlineFlag, lastSeenAt, nowMs);
  if (online) {
    return 'в сети';
  }

  if (!lastSeenAt) {
    return 'давно не в сети';
  }

  const seenDate = new Date(lastSeenAt);
  if (Number.isNaN(seenDate.getTime())) {
    return 'давно не в сети';
  }

  const diffMs = nowMs - seenDate.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / (60 * 1000)));

  if (diffMinutes < 60) {
    return `был(а) в сети ${diffMinutes} мин назад`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `был(а) в сети ${diffHours} ч назад`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `был(а) в сети ${diffDays} дн назад`;
};
