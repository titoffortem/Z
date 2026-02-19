'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useFirestore } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChevronLeft, Loader2, MessageSquare, Search, SendHorizontal } from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import type { UserProfile } from '@/types';

type ChatItem = {
  id: string;
  participantIds: string[];
  lastMessageText: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
};

const formatTime = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toIsoDate = (value: unknown) => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  return new Date().toISOString();
};

const getChatId = (userA: string, userB: string) => [userA, userB].sort().join('_');

export default function MessagesPage() {
  const { user } = useAuth();
  const firestore = useFirestore();

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, UserProfile>>({});
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [chatLoading, setChatLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<UserProfile[]>([]);

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const isMobile = useIsMobile();
  const [isMobileDialogOpen, setMobileDialogOpen] = useState(false);

  useEffect(() => {
    if (!user || !firestore) {
      setChats([]);
      setChatLoading(false);
      return;
    }

    const chatsRef = collection(firestore, 'chats');
    const chatsQuery = query(chatsRef, where('participantIds', 'array-contains', user.uid));

    const unsubscribe = onSnapshot(
      chatsQuery,
      (snapshot) => {
        const nextChats: ChatItem[] = snapshot.docs
          .map((chatDoc) => {
            const data = chatDoc.data();
            return {
              id: chatDoc.id,
              participantIds: data.participantIds || [],
              lastMessageText: data.lastMessageText || '',
              updatedAt: toIsoDate(data.updatedAt),
            };
          })
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        setChats(nextChats);
        setChatLoading(false);
      },
      () => {
        setChatLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, user]);


  useEffect(() => {
    if (chats.length === 0) {
      if (selectedChatId !== null) {
        setSelectedChatId(null);
      }
      setMobileDialogOpen(false);
      return;
    }

    if (selectedChatId && !chats.some((chat) => chat.id === selectedChatId)) {
      setSelectedChatId(null);
      setMobileDialogOpen(false);
    }
  }, [chats, selectedChatId]);

  useEffect(() => {
    if (!firestore || !user || chats.length === 0) {
      return;
    }

    const partnerIds = Array.from(
      new Set(
        chats
          .flatMap((chat) => chat.participantIds)
          .filter((participantId) => participantId && participantId !== user.uid)
      )
    );

    if (partnerIds.length === 0) {
      return;
    }

    Promise.all(
      partnerIds.map(async (partnerId) => {
        const profileDoc = await getDoc(doc(firestore, 'users', partnerId));
        if (!profileDoc.exists()) {
          return null;
        }

        const profileData = profileDoc.data();
        const profile: UserProfile = {
          id: profileDoc.id,
          nickname: profileData.nickname || 'Пользователь',
          profilePictureUrl: profileData.profilePictureUrl || null,
          createdAt: toIsoDate(profileData.createdAt),
          followingUserIds: profileData.followingUserIds || [],
          followerUserIds: profileData.followerUserIds || [],
        };

        return profile;
      })
    ).then((profiles) => {
      const nextProfilesById = profiles.reduce<Record<string, UserProfile>>((acc, profile) => {
        if (profile) {
          acc[profile.id] = profile;
        }
        return acc;
      }, {});

      setProfilesById((prev) => ({ ...prev, ...nextProfilesById }));
    });
  }, [chats, firestore, user]);

  useEffect(() => {
    if (!firestore || !selectedChatId) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);

    const messagesRef = collection(firestore, 'chats', selectedChatId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const nextMessages: ChatMessage[] = snapshot.docs.map((messageDoc) => {
          const data = messageDoc.data();
          return {
            id: messageDoc.id,
            senderId: data.senderId || '',
            text: data.text || '',
            createdAt: toIsoDate(data.createdAt),
          };
        });
        setMessages(nextMessages);
        setMessagesLoading(false);
      },
      () => {
        setMessagesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, selectedChatId]);

  useEffect(() => {
    const trimmedTerm = searchTerm.trim();
    if (!firestore || !trimmedTerm || trimmedTerm.length < 3 || !user) {
      setUserSearchResults([]);
      setUserSearchLoading(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const usersSnapshot = await getDocs(query(collection(firestore, 'users')));
        const normalizedTerm = trimmedTerm.toLowerCase();

        const foundUsers = usersSnapshot.docs
          .map((userDoc) => {
            const data = userDoc.data();
            return {
              id: userDoc.id,
              nickname: data.nickname || '',
              profilePictureUrl: data.profilePictureUrl || null,
              createdAt: toIsoDate(data.createdAt),
              followingUserIds: data.followingUserIds || [],
              followerUserIds: data.followerUserIds || [],
            } as UserProfile;
          })
          .filter((candidate) => candidate.id !== user.uid && candidate.nickname.toLowerCase().includes(normalizedTerm))
          .slice(0, 8);

        setUserSearchResults(foundUsers);
      } finally {
        setUserSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [firestore, searchTerm, user]);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) || null,
    [chats, selectedChatId]
  );

  const selectedPartnerProfile = useMemo(() => {
    if (!selectedChat || !user) {
      return null;
    }
    const partnerId = selectedChat.participantIds.find((participantId) => participantId !== user.uid);
    if (!partnerId) {
      return null;
    }
    return profilesById[partnerId] || null;
  }, [profilesById, selectedChat, user]);

  const openOrCreateDialog = async (targetUser: UserProfile) => {
    if (!firestore || !user) {
      return;
    }

    const chatId = getChatId(user.uid, targetUser.id);
    const chatRef = doc(firestore, 'chats', chatId);

    const existingChat = await getDoc(chatRef);

    if (!existingChat.exists()) {
      await setDoc(chatRef, {
        participantIds: [user.uid, targetUser.id],
        updatedAt: serverTimestamp(),
        lastMessageText: '',
      });
    }

    setProfilesById((prev) => ({ ...prev, [targetUser.id]: targetUser }));
    setSelectedChatId(chatId);
    setMobileDialogOpen(true);
    setSearchTerm('');
    setUserSearchResults([]);
  };

  const handleSend = async () => {
    const text = newMessage.trim();

    if (!firestore || !user || !selectedChatId || !text) {
      return;
    }

    setSending(true);

    try {
      await addDoc(collection(firestore, 'chats', selectedChatId, 'messages'), {
        senderId: user.uid,
        text,
        createdAt: serverTimestamp(),
      });

      await setDoc(
        doc(firestore, 'chats', selectedChatId),
        {
          lastMessageText: text,
          lastMessageSenderId: user.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setNewMessage('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-5xl relative">
      <section className={`w-full md:max-w-sm border-r border-border/50 ${isMobile && isMobileDialogOpen ? 'hidden' : 'block'}`}>
        <header className="border-b border-border/50 p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <h1 className="text-xl font-bold">Сообщения</h1>
          <div className="relative mt-3">
            {userSearchLoading ? (
              <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : (
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            )}
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10"
              placeholder="Найти пользователя..."
            />
          </div>
        </header>

        {userSearchResults.length > 0 && (
          <div className="border-b border-border/50 p-2 space-y-1">
            {userSearchResults.map((searchUser) => (
              <button
                key={searchUser.id}
                type="button"
                onClick={() => openOrCreateDialog(searchUser)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-accent/50"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={searchUser.profilePictureUrl ?? undefined} alt={searchUser.nickname} />
                  <AvatarFallback>{searchUser.nickname[0]?.toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{searchUser.nickname}</span>
              </button>
            ))}
          </div>
        )}

        <div className="overflow-y-auto h-[calc(100%-124px)] p-2">
          {chatLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : chats.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-30" />
              <p>Пока нет переписок</p>
              <p className="text-sm">Найдите пользователя и начните диалог</p>
            </div>
          ) : (
            chats.map((chat) => {
              const partnerId = user ? chat.participantIds.find((id) => id !== user.uid) : null;
              const partner = partnerId ? profilesById[partnerId] : null;

              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => {
                    setSelectedChatId(chat.id);
                    setMobileDialogOpen(true);
                  }}
                  className={`mb-1 flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
                    selectedChatId === chat.id ? 'bg-[#577F59] text-white' : 'hover:bg-accent/50'
                  }`}
                >
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={partner?.profilePictureUrl ?? undefined} alt={partner?.nickname || 'User'} />
                    <AvatarFallback>{partner?.nickname?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{partner?.nickname || 'Пользователь'}</p>
                    <p className={`truncate text-sm ${selectedChatId === chat.id ? 'text-white/80' : 'text-muted-foreground'}`}>{chat.lastMessageText || 'Сообщений пока нет'}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className={`flex-1 flex-col bg-background ${isMobile ? 'fixed inset-0 z-30' : 'flex'} ${isMobile && !isMobileDialogOpen ? 'hidden' : 'flex'}`}>
        <header className="border-b border-border/50 p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10 min-h-[73px]">
          {selectedPartnerProfile ? (
            <div className="flex items-center gap-3">
              {isMobile && (
                <Button variant="ghost" size="icon" onClick={() => setMobileDialogOpen(false)} className="mr-1">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              <Avatar>
                <AvatarImage src={selectedPartnerProfile.profilePictureUrl ?? undefined} alt={selectedPartnerProfile.nickname} />
                <AvatarFallback>{selectedPartnerProfile.nickname[0]?.toUpperCase() || '?'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{selectedPartnerProfile.nickname}</p>
                <p className="text-xs text-muted-foreground">Личные сообщения</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {isMobile && (
                <Button variant="ghost" size="icon" onClick={() => setMobileDialogOpen(false)}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              <p className="text-muted-foreground">Выберите диалог</p>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!selectedChatId ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">Откройте или создайте диалог</div>
          ) : messagesLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">Начните общение первым сообщением</div>
          ) : (
            messages.map((message) => {
              const isMine = message.senderId === user?.uid;
              return (
                <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                      isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    <p className="mt-1 text-right text-[11px] opacity-70">{formatTime(message.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-border/50 p-3">
          <div className="flex items-center gap-2">
            <Textarea
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              placeholder={selectedChatId ? 'Напишите сообщение...' : 'Сначала выберите диалог'}
              disabled={!selectedChatId || sending}
              className="min-h-[44px] max-h-32"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button type="button" onClick={handleSend} disabled={!selectedChatId || sending || !newMessage.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
