'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useFirestore } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { firebaseConfig } from '@/firebase/config';
import { ChevronDown, ChevronLeft, Loader2, MessageSquare, Search, SendHorizontal } from 'lucide-react';
import {
  addDoc,
  arrayUnion,
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
  updateDoc,
  where,
  writeBatch,
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
  readBy: string[];
  imageUrls: string[];
  forwardedMessage?: {
    id: string;
    senderId: string;
    text: string;
    imageUrls: string[];
    createdAt: string;
  };
};

async function uploadToImgBB(file: File): Promise<string | null> {
  const apiKey = firebaseConfig.imgbbKey;
  if (!apiKey) {
    return null;
  }

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data?.data?.url ?? null;
  } catch {
    return null;
  }
}

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
  const isMobile = useIsMobile();

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
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [forwardedMessage, setForwardedMessage] = useState<ChatMessage | null>(null);
  const [forwardTargetChatId, setForwardTargetChatId] = useState<string | null>(null);
  const [isMobileDialogOpen, setMobileDialogOpen] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateBottomState = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 4;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);


  useEffect(() => {
    const handleCloseMobileChat = () => setMobileDialogOpen(false);
    window.addEventListener('z:close-mobile-chat', handleCloseMobileChat);
    return () => window.removeEventListener('z:close-mobile-chat', handleCloseMobileChat);
  }, []);

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
      new Set(chats.flatMap((chat) => chat.participantIds).filter((participantId) => participantId && participantId !== user.uid))
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
      previousMessageCountRef.current = 0;
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
            readBy: data.readBy || [],
            imageUrls: data.imageUrls || [],
            forwardedMessage: data.forwardedMessage || undefined,
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
    if (!selectedChatId) {
      return;
    }

    setForwardTargetChatId((prev) => prev ?? selectedChatId);

    isAtBottomRef.current = true;
    setIsAtBottom(true);

    const rafId = requestAnimationFrame(() => {
      scrollToBottom('auto');
    });

    return () => cancelAnimationFrame(rafId);
  }, [selectedChatId, scrollToBottom]);

  useEffect(() => {
    if (!selectedChatId) {
      return;
    }

    const prevCount = previousMessageCountRef.current;
    const nextCount = messages.length;
    previousMessageCountRef.current = nextCount;

    if (nextCount === 0) {
      return;
    }

    if (nextCount > prevCount && isAtBottomRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom('smooth');
      });
    }
  }, [messages, selectedChatId, scrollToBottom]);

  useEffect(() => {
    if (!firestore || !user || !selectedChatId || messages.length === 0) {
      return;
    }

    const unreadIncoming = messages.filter((message) => message.senderId !== user.uid && !message.readBy.includes(user.uid));

    if (unreadIncoming.length === 0) {
      return;
    }

    const batch = writeBatch(firestore);

    unreadIncoming.forEach((message) => {
      const messageRef = doc(firestore, 'chats', selectedChatId, 'messages', message.id);
      batch.update(messageRef, {
        readBy: arrayUnion(user.uid),
      });
    });

    void batch.commit();
  }, [firestore, messages, selectedChatId, user]);

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

  const selectedChat = useMemo(() => chats.find((chat) => chat.id === selectedChatId) || null, [chats, selectedChatId]);

  const selectedPartnerId = useMemo(() => {
    if (!selectedChat || !user) {
      return null;
    }

    return selectedChat.participantIds.find((participantId) => participantId !== user.uid) || null;
  }, [selectedChat, user]);

  const selectedPartnerProfile = useMemo(() => {
    if (!selectedPartnerId) {
      return null;
    }
    return profilesById[selectedPartnerId] || null;
  }, [profilesById, selectedPartnerId]);

  const selectedImagePreviews = useMemo(
    () => selectedImages.map((file) => ({ key: `${file.name}-${file.size}-${file.lastModified}`, url: URL.createObjectURL(file) })),
    [selectedImages]
  );

  useEffect(() => {
    return () => {
      selectedImagePreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [selectedImagePreviews]);

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
    const targetChatId = forwardTargetChatId || selectedChatId;
    const hasPayload = Boolean(text || selectedImages.length > 0 || forwardedMessage);

    if (!firestore || !user || !targetChatId || !hasPayload) {
      return;
    }

    setSending(true);

    try {
      let imageUrls: string[] = [];

      if (selectedImages.length > 0) {
        const uploaded = await Promise.all(selectedImages.map((file) => uploadToImgBB(file)));
        imageUrls = uploaded.filter((url): url is string => Boolean(url));
      }

      await addDoc(collection(firestore, 'chats', targetChatId, 'messages'), {
        senderId: user.uid,
        text,
        imageUrls,
        forwardedMessage: forwardedMessage
          ? {
              id: forwardedMessage.id,
              senderId: forwardedMessage.senderId,
              text: forwardedMessage.text,
              imageUrls: forwardedMessage.imageUrls,
              createdAt: forwardedMessage.createdAt,
            }
          : null,
        createdAt: serverTimestamp(),
        readBy: [user.uid],
      });

      await updateDoc(doc(firestore, 'chats', targetChatId), {
        lastMessageText: text || (imageUrls.length > 0 ? `📷 ${imageUrls.length}` : '↪ Переслано сообщение'),
        lastMessageSenderId: user.uid,
        updatedAt: serverTimestamp(),
      });

      setNewMessage('');
      setSelectedImages([]);
      setForwardedMessage(null);
      setForwardTargetChatId(selectedChatId);
      requestAnimationFrame(() => {
        scrollToBottom('smooth');
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto relative flex h-full max-w-5xl">
      <section className={`w-full border-r border-border/50 md:max-w-sm ${isMobile && isMobileDialogOpen ? 'hidden' : 'block'}`}>
        <header
          className="sticky top-0 z-10 border-b border-border/50 bg-background/80 p-4 backdrop-blur-sm"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        >
          <h1 className="text-xl font-bold">Сообщения</h1>
          <div className="relative mt-3">
            {userSearchLoading ? (
              <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : (
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            )}
            <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-10" placeholder="Найти пользователя..." />
          </div>
        </header>

        {userSearchResults.length > 0 && (
          <div className="space-y-1 border-b border-border/50 p-2">
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

        <div className="h-[calc(100%-124px)] overflow-y-auto p-2">
          {chatLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : chats.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2 p-2 text-center text-muted-foreground">
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
                    <p className={`truncate text-sm ${selectedChatId === chat.id ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {chat.lastMessageText || 'Сообщений пока нет'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section
        data-mobile-chat-open={isMobile && isMobileDialogOpen ? 'true' : 'false'}
        className={`flex-1 flex-col bg-background ${isMobile ? 'fixed inset-0 z-30' : 'flex'} ${isMobile && !isMobileDialogOpen ? 'hidden' : 'flex'}`}
      >
        <header
          className="sticky top-0 z-10 min-h-[73px] border-b border-border/50 bg-background/80 p-4 backdrop-blur-sm"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        >
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

        <div ref={messagesContainerRef} onScroll={updateBottomState} className="relative flex-1 space-y-3 overflow-y-auto p-4">
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
              const isReadByPartner = Boolean(selectedPartnerId && message.readBy.includes(selectedPartnerId));

              return (
                <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                      isMine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted'
                    }`}
                  >
                    {message.forwardedMessage && (
                      <div className="mb-2 rounded-md border border-border/60 bg-background/40 p-2 text-xs">
                        <p className="mb-1 opacity-70">Переслано</p>
                        {message.forwardedMessage.text && <p className="line-clamp-3">{message.forwardedMessage.text}</p>}
                        {message.forwardedMessage.imageUrls?.length > 0 && (
                          <p className="mt-1 opacity-80">📷 {message.forwardedMessage.imageUrls.length}</p>
                        )}
                      </div>
                    )}

                    <p className="break-words whitespace-pre-wrap">{message.text}</p>

                    {message.imageUrls.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {message.imageUrls.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="message" className="h-28 w-full rounded-md object-cover" />
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-end gap-2 text-[11px] opacity-70">
                      <span>{formatTime(message.createdAt)}</span>
                      {isMine && <span>{isReadByPartner ? '✓✓' : '✓'}</span>}
                    </div>

                    <div className="mt-1 flex justify-end">
                      <button
                        type="button"
                        className="text-[11px] opacity-70 hover:opacity-100"
                        onClick={() => {
                          setForwardedMessage(message);
                          setForwardTargetChatId(selectedChatId);
                        }}
                      >
                        Переслать
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

        </div>

        {selectedChatId && !isAtBottom && (
          <Button
            type="button"
            size="icon"
            onClick={() => scrollToBottom('smooth')}
            className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] right-4 z-40 h-10 w-10 rounded-full bg-[#40594D] text-white shadow-md hover:bg-[#4b6a5b]"
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        )}

        {forwardedMessage && (
          <div className="mx-3 mb-2 rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <span>Пересылка сообщения</span>
              <button type="button" className="opacity-70 hover:opacity-100" onClick={() => setForwardedMessage(null)}>
                ✕
              </button>
            </div>
            <p className="line-clamp-2 opacity-80">{forwardedMessage.text || 'Без текста'}</p>
            {forwardedMessage.imageUrls.length > 0 && <p className="mt-1 opacity-80">📷 {forwardedMessage.imageUrls.length}</p>}
            <div className="mt-2">
              <label className="mb-1 block opacity-80">Куда переслать:</label>
              <select
                className="w-full rounded-md border border-border bg-background px-2 py-1"
                value={forwardTargetChatId || selectedChatId || ''}
                onChange={(event) => setForwardTargetChatId(event.target.value)}
              >
                {chats.map((chat) => {
                  const partnerId = chat.participantIds.find((id) => id !== user?.uid);
                  const partner = partnerId ? profilesById[partnerId] : null;
                  return (
                    <option key={chat.id} value={chat.id}>
                      {partner?.nickname || 'Пользователь'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        )}

        {selectedImages.length > 0 && (
          <div className="mx-3 mb-2 flex gap-2 overflow-x-auto pb-1">
            {selectedImagePreviews.map((item) => (
              <div key={item.key} className="relative">
                <img src={item.url} alt="upload" className="h-16 w-16 rounded-md object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border/50 p-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => setSelectedImages(Array.from(event.target.files || []))}
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              📷
            </Button>
            <Textarea
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              placeholder={selectedChatId ? 'Напишите сообщение или комментарий к пересылке...' : 'Сначала выберите диалог'}
              disabled={!selectedChatId || sending}
              className="max-h-32 min-h-[44px]"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
            />
            <Button
              type="button"
              onClick={() => void handleSend()}
              disabled={!selectedChatId || sending || (!newMessage.trim() && selectedImages.length === 0 && !forwardedMessage)}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
