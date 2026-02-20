'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/components/auth-provider';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

type UnreadMessagesContextValue = {
  unreadByChatId: Record<string, number>;
  totalUnread: number;
};

const UnreadMessagesContext = createContext<UnreadMessagesContextValue | null>(null);

export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const firestore = useFirestore();
  const [unreadByChatId, setUnreadByChatId] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!firestore || !user) {
      setUnreadByChatId({});
      return;
    }

    const chatsRef = collection(firestore, 'chats');
    const chatsQuery = query(chatsRef, where('participantIds', 'array-contains', user.uid));
    let messageUnsubs: (() => void)[] = [];

    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
      messageUnsubs.forEach((u) => u());
      messageUnsubs = [];

      const chatIds = snapshot.docs.map((d) => d.id);
      if (chatIds.length === 0) {
        setUnreadByChatId({});
        return;
      }

      messageUnsubs = chatIds.map((chatId) =>
        onSnapshot(collection(firestore, 'chats', chatId, 'messages'), (msgSnapshot) => {
          const unreadCount = msgSnapshot.docs.reduce((acc, messageDoc) => {
            const data = messageDoc.data();
            const senderId = data.senderId || '';
            const readBy = Array.isArray(data.readBy) ? data.readBy : [];
            if (senderId !== user.uid && !readBy.includes(user.uid)) {
              return acc + 1;
            }
            return acc;
          }, 0);

          setUnreadByChatId((prev) => ({ ...prev, [chatId]: unreadCount }));
        })
      );
    });

    return () => {
      messageUnsubs.forEach((u) => u());
      unsubChats();
    };
  }, [firestore, user]);

  const totalUnread = useMemo(
    () => Object.values(unreadByChatId).reduce((sum, n) => sum + n, 0),
    [unreadByChatId]
  );

  const value = useMemo(
    () => ({ unreadByChatId, totalUnread }),
    [unreadByChatId, totalUnread]
  );

  return (
    <UnreadMessagesContext.Provider value={value}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages(): UnreadMessagesContextValue {
  const ctx = useContext(UnreadMessagesContext);
  if (!ctx) {
    return { unreadByChatId: {}, totalUnread: 0 };
  }
  return ctx;
}
