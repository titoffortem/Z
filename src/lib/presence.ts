import { Timestamp } from 'firebase/firestore';

const ONLINE_GRACE_PERIOD_MS = 90 * 1000;

export const toOptionalIsoDate = (value: unknown): string | null => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
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

export const isUserOnline = (isOnlineFlag?: boolean, lastSeenAt?: string | null): boolean => {
  if (!lastSeenAt) {
    return Boolean(isOnlineFlag);
  }

  const parsedDate = new Date(lastSeenAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return Boolean(isOnlineFlag);
  }

  const isRecentlyActive = Date.now() - parsedDate.getTime() <= ONLINE_GRACE_PERIOD_MS;
  return Boolean(isOnlineFlag) || isRecentlyActive;
};

export const getPresenceLabel = (isOnlineFlag?: boolean, lastSeenAt?: string | null): string => {
  const online = isUserOnline(isOnlineFlag, lastSeenAt);
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

  const diffMs = Date.now() - seenDate.getTime();
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
