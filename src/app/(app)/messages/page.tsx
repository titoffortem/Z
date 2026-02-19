'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { PostView } from '@/components/post-view';
import { useFirestore } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { firebaseConfig } from '@/firebase/config';
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, MessageSquare, Paperclip, Search, Send, X } from 'lucide-react';
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
import type { Post, UserProfile } from '@/types';

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
  forwardedMessages?: Array<{
    id: string;
    senderId: string;
    text: string;
    imageUrls: string[];
    createdAt: string;
  }>;
  forwardedMessage?: {
    id: string;
    senderId: string;
    text: string;
    imageUrls: string[];
    createdAt: string;
  };
  forwardedPost?: {
    postId: string;
    caption: string;
    mediaUrls: string[];
    mediaTypes: string[];
    authorId: string;
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

function SingleCheckIcon() {
  return (
    <svg viewBox="0 0 329.14 258.16" className="h-[10px] w-auto" aria-hidden="true">
      <rect
        fill="#c9d5ca"
        x="158.56"
        y="-24.75"
        width="83.01"
        height="307.66"
        rx="21.84"
        ry="21.84"
        transform="translate(149.87 -103.66) rotate(45)"
      />
      <rect
        fill="#c9d5ca"
        x="43.61"
        y="81.28"
        width="83.01"
        height="183.31"
        rx="21.84"
        ry="21.84"
        transform="translate(-97.35 110.83) rotate(-45)"
      />
    </svg>
  );
}

function DoubleCheckIcon() {
  return (
    <svg viewBox="0 0 505.33 258.61" className="h-[10px] w-auto" aria-hidden="true">
      <rect
        fill="#c9d5ca"
        x="334.74"
        y="-24.3"
        width="83.01"
        height="307.66"
        rx="21.84"
        ry="21.84"
        transform="translate(201.79 -228.11) rotate(45)"
      />
      <rect
        fill="#c9d5ca"
        x="158.56"
        y="-24.75"
        width="83.01"
        height="307.66"
        rx="21.84"
        ry="21.84"
        transform="translate(149.87 -103.66) rotate(45)"
      />
      <rect
        fill="#c9d5ca"
        x="43.61"
        y="81.28"
        width="83.01"
        height="183.31"
        rx="21.84"
        ry="21.84"
        transform="translate(-97.35 110.83) rotate(-45)"
      />
    </svg>
  );
}

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
  const [selectedForwardMessageIds, setSelectedForwardMessageIds] = useState<string[]>([]);
  const [forwardComment, setForwardComment] = useState('');
  const [isForwardPickerOpen, setForwardPickerOpen] = useState(false);
  const [isMobileDialogOpen, setMobileDialogOpen] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [expandedImages, setExpandedImages] = useState<string[] | null>(null);
  const [expandedImageIndex, setExpandedImageIndex] = useState(0);
  const [expandedPost, setExpandedPost] = useState<Post | null>(null);
  const [expandedPostAuthor, setExpandedPostAuthor] = useState<UserProfile | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messageElementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isAtBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const openImageViewer = (images: string[], index: number) => {
    setExpandedImages(images);
    setExpandedImageIndex(index);
  };

  const closeImageViewer = () => {
    setExpandedImages(null);
    setExpandedImageIndex(0);
  };

  const openForwardedPost = async (forwardedPost: NonNullable<ChatMessage['forwardedPost']>, fallbackCreatedAt: string) => {
    if (!firestore) {
      return;
    }

    const postRef = doc(firestore, 'posts', forwardedPost.postId);
    const postDoc = await getDoc(postRef);

    let nextPost: Post;
    if (postDoc.exists()) {
      const data = postDoc.data();
      nextPost = {
        id: postDoc.id,
        userId: data.userId || forwardedPost.authorId,
        caption: data.caption || forwardedPost.caption || '',
        mediaUrls: data.mediaUrls || forwardedPost.mediaUrls || [],
        mediaTypes: data.mediaTypes || forwardedPost.mediaTypes || [],
        createdAt: toIsoDate(data.createdAt),
        updatedAt: toIsoDate(data.updatedAt),
        likedBy: data.likedBy || [],
      };
    } else {
      nextPost = {
        id: forwardedPost.postId,
        userId: forwardedPost.authorId,
        caption: forwardedPost.caption || '',
        mediaUrls: forwardedPost.mediaUrls || [],
        mediaTypes: forwardedPost.mediaTypes || [],
        createdAt: fallbackCreatedAt,
        updatedAt: fallbackCreatedAt,
        likedBy: [],
      };
    }

    setExpandedPost(nextPost);

    const knownAuthor = profilesById[nextPost.userId] || null;
    if (knownAuthor) {
      setExpandedPostAuthor(knownAuthor);
      return;
    }

    const authorDoc = await getDoc(doc(firestore, 'users', nextPost.userId));
    if (!authorDoc.exists()) {
      setExpandedPostAuthor(null);
      return;
    }

    const data = authorDoc.data();
    setExpandedPostAuthor({
      id: authorDoc.id,
      nickname: data.nickname || 'Пользователь',
      profilePictureUrl: data.profilePictureUrl ?? null,
      createdAt: toIsoDate(data.createdAt),
      followingUserIds: data.followingUserIds || [],
      followerUserIds: data.followerUserIds || [],
    });
  };

  const showNextExpandedImage = () => {
    if (!expandedImages || expandedImages.length <= 1) {
      return;
    }
    setExpandedImageIndex((prev) => (prev + 1) % expandedImages.length);
  };

  const showPrevExpandedImage = () => {
    if (!expandedImages || expandedImages.length <= 1) {
      return;
    }
    setExpandedImageIndex((prev) => (prev - 1 + expandedImages.length) % expandedImages.length);
  };

  const scrollToOriginalMessage = (messageId: string) => {
    const target = messageElementRefs.current[messageId];
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

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
            forwardedMessages: data.forwardedMessages || undefined,
            forwardedMessage: data.forwardedMessage || undefined,
            forwardedPost: data.forwardedPost || undefined,
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

  const toggleForwardMessageSelection = (messageId: string) => {
    setSelectedForwardMessageIds((prev) => (prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]));
  };

  const forwardSelectedMessages = async (targetChatId: string) => {
    if (!firestore || !user || selectedForwardMessageIds.length === 0) {
      return;
    }

    const selectedMessages = messages.filter((message) => selectedForwardMessageIds.includes(message.id));
    if (selectedMessages.length === 0) {
      return;
    }

    const flattenedForwardPayloads = selectedMessages.flatMap((message) => {
      if (message.forwardedMessages && message.forwardedMessages.length > 0) {
        return message.forwardedMessages;
      }

      if (message.forwardedMessage) {
        return [message.forwardedMessage];
      }

      return [
        {
          id: message.id,
          senderId: message.senderId,
          text: message.text,
          imageUrls: message.imageUrls,
          createdAt: message.createdAt,
        },
      ];
    });

    await addDoc(collection(firestore, 'chats', targetChatId, 'messages'), {
      senderId: user.uid,
      text: forwardComment.trim(),
      imageUrls: [],
      forwardedMessages: flattenedForwardPayloads,
      forwardedMessage: null,
      createdAt: serverTimestamp(),
      readBy: [user.uid],
    });

    await updateDoc(doc(firestore, 'chats', targetChatId), {
      lastMessageText: `↪ Переслано ${selectedMessages.length}`,
      lastMessageSenderId: user.uid,
      updatedAt: serverTimestamp(),
    });

    setSelectedForwardMessageIds([]);
    setForwardComment('');
    setForwardPickerOpen(false);
    setMobileDialogOpen(true);
    requestAnimationFrame(() => {
      scrollToBottom('smooth');
    });
  };

  const handleSend = async () => {
    const text = newMessage.trim();
    const targetChatId = selectedChatId;
    const hasPayload = Boolean(text || selectedImages.length > 0);

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
        forwardedMessage: null,
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
              const hasMessageText = Boolean(message.text?.trim());
              const normalizedForwarded = message.forwardedMessages && message.forwardedMessages.length > 0
                ? message.forwardedMessages
                : message.forwardedMessage
                  ? [message.forwardedMessage]
                  : [];
              const hasForwardedContent = normalizedForwarded.length > 0;
              const hasForwardedPost = Boolean(message.forwardedPost);
              const hasImages = message.imageUrls.length > 0;
              const isImageOnlyMessage = !hasForwardedContent && !hasForwardedPost && !hasMessageText && hasImages;
              const isSelectedForForward = selectedForwardMessageIds.includes(message.id);
              return (
                <div
                  key={message.id}
                  ref={(element) => {
                    messageElementRefs.current[message.id] = element;
                  }}
                  className={`flex cursor-pointer ${isMine ? 'justify-end' : 'justify-start'}`}
                  onClick={() => toggleForwardMessageSelection(message.id)}
                >
                  <div
                    className={`rounded-2xl ${isImageOnlyMessage ? 'w-fit p-1' : 'max-w-[75%] px-3 py-2'} ${
                      isSelectedForForward
                        ? isMine
                          ? 'rounded-br-sm bg-[#A7BBA9] text-[#1f2a23]'
                          : 'rounded-bl-sm bg-[#A7BBA9] text-[#1f2a23]'
                        : isMine
                          ? 'rounded-br-sm bg-primary text-primary-foreground'
                          : 'rounded-bl-sm bg-muted'
                    } ${
                      isSelectedForForward
                        ? 'ring-2 ring-[#A7BBA9]'
                        : ''
                    } ${highlightedMessageId === message.id ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    {normalizedForwarded.length > 0 && (
                      <div className="mb-2 rounded-md border border-border/60 bg-background/40 p-2 text-xs">
                        <div className="space-y-1">
                          {normalizedForwarded.map((forwarded, idx) => {
                            const prevSenderId = normalizedForwarded[idx - 1]?.senderId;
                            const showSenderLabel = idx === 0 || prevSenderId !== forwarded.senderId;

                            return (
                            <button
                              key={`${forwarded.id}-${forwarded.createdAt}`}
                              type="button"
                              className="block w-full rounded-sm border border-border/40 p-1 text-left transition hover:bg-background/40"
                              onClick={(event) => {
                                event.stopPropagation();
                                scrollToOriginalMessage(forwarded.id);
                              }}
                            >
                              {showSenderLabel && (
                                <p className="mb-0.5 text-[11px] opacity-70">
                                  От {profilesById[forwarded.senderId]?.nickname || 'пользователя'}
                                </p>
                              )}
                              {forwarded.text && <p className="line-clamp-2">{forwarded.text}</p>}
                              {forwarded.imageUrls?.length > 0 && <p className="mt-1 opacity-80">📷 {forwarded.imageUrls.length}</p>}
                            </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {message.forwardedPost && (
                      <button
                        type="button"
                        className="mb-2 block w-full rounded-md border border-border/60 bg-background/40 p-2 text-left text-xs transition hover:bg-background/60"
                        onClick={async (event) => {
                          event.stopPropagation();
                          await openForwardedPost(message.forwardedPost!, message.createdAt);
                        }}
                      >
                        <p className="mb-1 text-[11px] opacity-70">Переслан пост</p>
                        {profilesById[message.forwardedPost.authorId]?.nickname && (
                          <p className="mb-1 text-[11px] opacity-70">От {profilesById[message.forwardedPost.authorId]?.nickname}</p>
                        )}
                        {message.forwardedPost.caption && (
                          <p className="line-clamp-3 whitespace-pre-wrap break-words">{message.forwardedPost.caption}</p>
                        )}
                        {message.forwardedPost.mediaUrls?.length > 0 && (
                          <img
                            src={message.forwardedPost.mediaUrls[0]}
                            alt="forwarded post"
                            className="mt-2 h-28 w-28 rounded-md object-cover"
                          />
                        )}
                      </button>
                    )}

                    {hasMessageText && <p className="break-words whitespace-pre-wrap">{message.text}</p>}

                    {hasImages && (
                      <div
                        className={`${hasMessageText ? 'mt-2' : ''} grid gap-2 ${
                          message.imageUrls.length === 1 ? 'grid-cols-1 justify-items-start' : 'grid-cols-2'
                        }`}
                      >
                        {message.imageUrls.map((url, idx) => (
                          <button
                            key={`${url}-${idx}`}
                            type="button"
                            className={message.imageUrls.length === 1 ? 'w-fit' : ''}
                            onClick={(event) => {
                              event.stopPropagation();
                              openImageViewer(message.imageUrls, idx);
                            }}
                          >
                            <img
                              src={url}
                              alt="message"
                              className={`${message.imageUrls.length === 1 ? 'block h-48 w-auto max-w-[260px]' : 'h-28 w-28'} rounded-md object-cover`}
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-end gap-2 text-[11px] opacity-70">
                      <span>{formatTime(message.createdAt)}</span>
                      {isMine && (isReadByPartner ? <DoubleCheckIcon /> : <SingleCheckIcon />)}
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
          {selectedForwardMessageIds.length > 0 ? (
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-2 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span>Выбрано для пересылки: {selectedForwardMessageIds.length}</span>
                <button
                  type="button"
                  className="opacity-70 hover:opacity-100"
                  onClick={() => {
                    setSelectedForwardMessageIds([]);
                    setForwardComment('');
                  }}
                >
                  ✕
                </button>
              </div>
              <Textarea
                value={forwardComment}
                onChange={(event) => setForwardComment(event.target.value)}
                placeholder="Подпись к пересланному сообщению (необязательно)"
                className="min-h-[40px] resize-none bg-background/70"
              />
              <div className="mt-2 flex gap-2">
                <Button type="button" size="sm" onClick={() => selectedChatId && void forwardSelectedMessages(selectedChatId)}>
                  Переслать сюда
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setForwardPickerOpen(true)}>
                  Переслать
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-muted/50 p-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => setSelectedImages(Array.from(event.target.files || []))}
              />
              <div className="flex items-center gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  placeholder={selectedChatId ? 'Написать...' : 'Сначала выберите диалог'}
                  disabled={!selectedChatId || sending}
                  className="max-h-32 min-h-[40px] flex-1 resize-none border-none bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 self-center rounded-full" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  className="h-9 w-9 self-center rounded-full"
                  onClick={() => void handleSend()}
                  disabled={!selectedChatId || sending || (!newMessage.trim() && selectedImages.length === 0)}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={Boolean(expandedPost)}
        onOpenChange={(open) => {
          if (!open) {
            setExpandedPost(null);
            setExpandedPostAuthor(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl border-0 bg-card p-0">
          <DialogTitle className="sr-only">Просмотр пересланного поста</DialogTitle>
          <DialogDescription className="sr-only">Полный просмотр пересланного поста как в ленте.</DialogDescription>
          {expandedPost && <PostView post={expandedPost} author={expandedPostAuthor} />}
        </DialogContent>
      </Dialog>

      {expandedImages && expandedImages.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
          <button type="button" onClick={closeImageViewer} className="absolute right-4 top-4 rounded-full bg-background/70 p-2 text-foreground">
            <X className="h-5 w-5" />
          </button>

          {expandedImages.length > 1 && (
            <button type="button" onClick={showPrevExpandedImage} className="absolute left-4 rounded-full bg-background/70 p-2 text-foreground">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          <img
            src={expandedImages[expandedImageIndex]}
            alt="expanded"
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
          />

          {expandedImages.length > 1 && (
            <button type="button" onClick={showNextExpandedImage} className="absolute right-4 rounded-full bg-background/70 p-2 text-foreground">
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {isForwardPickerOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 p-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Выберите диалог для пересылки</h2>
            <Button variant="ghost" size="icon" onClick={() => setForwardPickerOpen(false)}>
              ✕
            </Button>
          </div>

          <div className="space-y-2 overflow-y-auto">
            {chats.map((chat) => {
              const partnerId = chat.participantIds.find((id) => id !== user?.uid);
              const partner = partnerId ? profilesById[partnerId] : null;

              return (
                <button
                  key={chat.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-border/50 p-3 text-left hover:bg-accent/30"
                  onClick={async () => {
                    await forwardSelectedMessages(chat.id);
                  }}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={partner?.profilePictureUrl ?? undefined} alt={partner?.nickname || 'User'} />
                    <AvatarFallback>{partner?.nickname?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{partner?.nickname || 'Пользователь'}</p>
                    <p className="text-xs text-muted-foreground">{chat.lastMessageText || 'Без сообщений'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
