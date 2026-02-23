'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Fragment, type ClipboardEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { PostCard } from '@/components/post-card';
import { PostView } from '@/components/post-view';
import { useFirestore } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { firebaseConfig } from '@/firebase/config';
import { ChevronDown, ChevronLeft, ChevronRight, Heart, Loader2, MessageSquare, Paperclip, Search, UserPlus, Users, X } from 'lucide-react';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
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
import { useUnreadMessages } from '@/contexts/unread-messages-context';
import { AppLoaderIcon } from '@/components/app-loader-icon';

import { useRouter, useSearchParams } from 'next/navigation';

type ChatItem = {
  id: string;
  participantIds: string[];
  lastMessageText: string;
  updatedAt: string;
  typingUserIds: string[];
  title?: string;
  isGroup?: boolean;
};

type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  readBy: string[];
  likedBy: string[];
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
    likedBy?: string[];
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

function TypingKeyboardIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      viewBox="0 0 1503.55 800"
      className="h-4 w-auto"
      aria-hidden="true"
    >
      <defs>
        <style>
          {`
            .typing-st0 {
              fill: none;
            }

            .typing-btn {
              transform-origin: center;
              transform-box: fill-box;
              fill: #a3a3a3;
              animation: typingPressSequence 1.5s ease-in-out infinite;
            }

            .typing-btn-1 { animation-delay: 0s; }
            .typing-btn-2 { animation-delay: 0.5s; }
            .typing-btn-3 { animation-delay: 1s; }

            @keyframes typingPressSequence {
              0%, 35%, 100% {
                transform: scale(1) translateY(0);
                fill: #a3a3a3;
              }
              10%, 20% {
                transform: scale(0.65) translateY(120px);
                fill: #577f59;
              }
            }
          `}
        </style>
      </defs>

      <rect className="typing-st0" width="800" height="800" />

      <g className="typing-btn typing-btn-1">
        <g>
          <path d="M80,480v-200c0-24,16-40,40-40h278v-40H120c-5.38.02-33.64.64-56.5,23.5-14.5,14.5-23.5,34.5-23.5,56.5v240c0,44,36,80,80,80h278v-80H120c-24,0-40-16-40-40Z" />
          <line x1="398" y1="520" x2="398" y2="520" />
        </g>
        <g>
          <path d="M438.03,480v-200c0-24-16-40-40-40H120.03v-40h278c5.38.02,33.64.64,56.5,23.5,14.5,14.5,23.5,34.5,23.5,56.5v240c0,44-36,80-80,80H120.03v-80h278c24,0,40-16,40-40Z" />
          <line x1="120.03" y1="520" x2="120.03" y2="520" />
        </g>
      </g>

      <g className="typing-btn typing-btn-2">
        <g>
          <path d="M558.03,480v-200c0-24,16-40,40-40h278v-40h-278c-5.38.02-33.64.64-56.5,23.5-14.5,14.5-23.5,34.5-23.5,56.5v240c0,44,36,80,80,80h278v-80h-278c-24,0-40-16-40-40Z" />
          <line x1="876.02" y1="520" x2="876.02" y2="520" />
        </g>
        <g>
          <path d="M916.05,480v-200c0-24-16-40-40-40h-278v-40h278c5.38.02,33.64.64,56.5,23.5,14.5,14.5,23.5,34.5,23.5,56.5v240c0,44-36,80-80,80h-278v-80h278c24,0,40-16,40-40Z" />
          <line x1="598.05" y1="520" x2="598.05" y2="520" />
        </g>
      </g>

      <g className="typing-btn typing-btn-3">
        <g>
          <path d="M1036.05,480v-200c0-24,16-40,40-40h278v-40h-278c-5.38.02-33.64.64-56.5,23.5-14.5,14.5-23.5,34.5-23.5,56.5v240c0,44,36,80,80,80h278v-80h-278c-24,0-40-16-40-40Z" />
          <line x1="1354.05" y1="520" x2="1354.05" y2="520" />
        </g>
        <g>
          <path d="M1394.08,480v-200c0-24-16-40-40-40h-278v-40h278c5.38.02,33.64.64,56.5,23.5,14.5,14.5,23.5,34.5,23.5,56.5v240c0,44-36,80-80,80h-278v-80h278c24,0,40-16,40-40Z" />
          <line x1="1076.08" y1="520" x2="1076.08" y2="520" />
        </g>
      </g>
    </svg>
  );
}


export default function MessagesPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const isMobile = useIsMobile();

  const router = useRouter();
  const searchParams = useSearchParams();

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [typingByChatId, setTypingByChatId] = useState<Record<string, string[]>>({});
  const [profilesById, setProfilesById] = useState<Record<string, UserProfile>>({});
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageHeartAnimationKeys, setMessageHeartAnimationKeys] = useState<Record<string, number>>({});

  const [chatLoading, setChatLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<UserProfile[]>([]);

  const [isCreateGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [isGroupMemberPickerOpen, setGroupMemberPickerOpen] = useState(false);
  const [groupSearchResults, setGroupSearchResults] = useState<UserProfile[]>([]);
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const [isInviteOpen, setInviteOpen] = useState(false);
  const [isParticipantsOpen, setParticipantsOpen] = useState(false);
  const [inviteSearchTerm, setInviteSearchTerm] = useState('');
  const [inviteSearchLoading, setInviteSearchLoading] = useState(false);
  const [inviteSearchResults, setInviteSearchResults] = useState<UserProfile[]>([]);
  const [inviteCandidatesLoading, setInviteCandidatesLoading] = useState(false);
  const [inviteCandidates, setInviteCandidates] = useState<UserProfile[]>([]);
  const { unreadByChatId } = useUnreadMessages();

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [messageSendAnimationKey, setMessageSendAnimationKey] = useState(0);
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
  const [forwardedPostLikesById, setForwardedPostLikesById] = useState<Record<string, string[]>>({});

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messageElementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isAtBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChatAndMessagesRef = useRef<{ chatId: string; messageIds: string[] } | null>(null);
  const initialScrollDoneForChatRef = useRef<string | null>(null);
  const typingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChatIdRef = useRef<string | null>(null);
  const isTypingRef = useRef(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const LINE_HEIGHT_PX = 20;
  const MIN_LINES = 2;
  const MAX_LINES = 2;
  const resizeMessageInput = useCallback(() => {
    const el = messageInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minH = LINE_HEIGHT_PX * MIN_LINES;
    const maxH = LINE_HEIGHT_PX * MAX_LINES;
    el.style.height = `${Math.max(minH, Math.min(maxH, el.scrollHeight))}px`;
  }, []);

  const handlePasteImageToMessageInput = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedImages = Array.from(event.clipboardData.items)
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (pastedImages.length === 0) {
      return;
    }

    event.preventDefault();
    setSelectedImages((prev) => [...prev, ...pastedImages]);
  };

  useEffect(() => {
    resizeMessageInput();
  }, [newMessage, resizeMessageInput]);

  const openImageViewer = (images: string[], index: number) => {
    setExpandedImages(images);
    setExpandedImageIndex(index);
  };

  const closeImageViewer = () => {
    setExpandedImages(null);
    setExpandedImageIndex(0);
  };

  useEffect(() => {
    if (!firestore) {
      return;
    }

    const postIds = Array.from(
      new Set(messages.map((message) => message.forwardedPost?.postId).filter((id): id is string => Boolean(id)))
    );

    if (postIds.length === 0) {
      return;
    }

    let cancelled = false;

    void Promise.all(postIds.map(async (postId) => {
      try {
        const snapshot = await getDoc(doc(firestore, 'posts', postId));
        if (!snapshot.exists()) {
          return [postId, null] as const;
        }
        const data = snapshot.data();
        return [postId, Array.isArray(data.likedBy) ? data.likedBy : []] as const;
      } catch {
        return [postId, null] as const;
      }
    })).then((pairs) => {
      if (cancelled) {
        return;
      }

      setForwardedPostLikesById((current) => {
        const next = { ...current };
        for (const [postId, likedBy] of pairs) {
          if (likedBy) {
            next[postId] = likedBy;
          }
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [firestore, messages]);

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
        likedBy: forwardedPostLikesById[forwardedPost.postId] || forwardedPost.likedBy || [],
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
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const setTypingStateForChat = useCallback(async (chatId: string, isTyping: boolean) => {
    if (!firestore || !user) {
      return;
    }

    try {
      await updateDoc(doc(firestore, 'chats', chatId), {
        typingUserIds: isTyping ? arrayUnion(user.uid) : arrayRemove(user.uid),
      });
    } catch {
      // Ignore chat-level typing update errors (some envs can restrict parent-doc writes).
    }

    try {
      const typingRef = doc(firestore, 'chats', chatId, 'typing', user.uid);
      if (isTyping) {
        await setDoc(typingRef, { updatedAt: serverTimestamp() }, { merge: true });
      } else {
        await deleteDoc(typingRef);
      }
    } catch {
      // Ignore typing subcollection errors to avoid interrupting message UI.
    }
  }, [firestore, user]);

  const stopTypingForChat = useCallback(async (chatId: string | null) => {
    if (!chatId || !isTypingRef.current || typingChatIdRef.current !== chatId) {
      return;
    }

    isTypingRef.current = false;
    typingChatIdRef.current = null;
    await setTypingStateForChat(chatId, false);
  }, [setTypingStateForChat]);

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

  const handleSelectChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    setMobileDialogOpen(true);
    // Обновляем URL без перезагрузки страницы
    router.push(`/messages?id=${chatId}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    const chatIdFromUrl = searchParams.get('id');
    
    // Если в URL есть ID, и он отличается от текущего выбранного
    if (chatIdFromUrl && chatIdFromUrl !== selectedChatId) {
      setSelectedChatId(chatIdFromUrl);
      setMobileDialogOpen(true);
    }
    // Если URL пустой, сбрасываем выделение (опционально)
    else if (!chatIdFromUrl && selectedChatId) {
      setSelectedChatId(null);
      setMobileDialogOpen(false);
    }
  }, [searchParams, selectedChatId]);

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
              typingUserIds: data.typingUserIds || [],
              title: data.title || '',
              isGroup: Boolean(data.isGroup),
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
    // Если чаты еще грузятся, ничего не делаем
    if (chatLoading) return; 

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
  }, [chats, selectedChatId, chatLoading]); // Добавьте chatLoading в зависимости

  useEffect(() => {
    if (!firestore || !user || chats.length === 0) {
      return;
    }

    const partnerIds = Array.from(
      new Set(chats.flatMap((chat) => chat.participantIds).filter((participantId) => Boolean(participantId)))
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
      return;
    }

    const typingRef = collection(firestore, 'chats', selectedChatId, 'typing');
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
      const ids = snapshot.docs.map((typingDoc) => typingDoc.id);
      setTypingByChatId((prev) => ({ ...prev, [selectedChatId]: ids }));
    });

    return () => unsubscribe();
  }, [firestore, selectedChatId]);

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
            likedBy: data.likedBy || [],
            imageUrls: data.imageUrls || [],
            forwardedMessages: data.forwardedMessages || undefined,
            forwardedMessage: data.forwardedMessage || undefined,
            forwardedPost: data.forwardedPost || undefined,
          };
        });
        setMessages(nextMessages);
        lastChatAndMessagesRef.current = { chatId: selectedChatId, messageIds: nextMessages.map((m) => m.id) };
        setMessagesLoading(false);
      },
      () => {
        setMessagesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, selectedChatId]);

  // Mark messages as read when leaving the chat (so divider disappears on reopen)
  useEffect(() => {
    if (!firestore || !user || !selectedChatId) {
      return;
    }
    const prev = lastChatAndMessagesRef.current;
    if (prev && prev.chatId !== selectedChatId) {
      initialScrollDoneForChatRef.current = null;
      if (prev.messageIds.length > 0) {
        const batch = writeBatch(firestore);
        prev.messageIds.forEach((messageId) => {
          const messageRef = doc(firestore, 'chats', prev.chatId, 'messages', messageId);
          batch.update(messageRef, { readBy: arrayUnion(user.uid) });
        });
        void batch.commit();
      }
    }
  }, [firestore, selectedChatId, user]);

  // On mobile: mark as read when user closes the chat panel (back to list)
  const prevMobileDialogOpenRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!isMobile || !firestore || !user || !selectedChatId) {
      return;
    }
    const wasOpen = prevMobileDialogOpenRef.current;
    prevMobileDialogOpenRef.current = isMobileDialogOpen;
    if (wasOpen === true && !isMobileDialogOpen) {
      initialScrollDoneForChatRef.current = null;
      const cur = lastChatAndMessagesRef.current;
      if (cur?.chatId === selectedChatId && cur.messageIds.length > 0) {
        const batch = writeBatch(firestore);
        cur.messageIds.forEach((messageId) => {
          const messageRef = doc(firestore, 'chats', selectedChatId, 'messages', messageId);
          batch.update(messageRef, { readBy: arrayUnion(user.uid) });
        });
        void batch.commit();
      }
    }
  }, [isMobile, isMobileDialogOpen, firestore, user, selectedChatId]);



  // Mark incoming messages as read while chat is open/viewed
  useEffect(() => {
    if (!firestore || !user || !selectedChatId) {
      return;
    }
    if (isMobile && !isMobileDialogOpen) {
      return;
    }

    const unreadIncomingIds = messages
      .filter((message) => message.senderId !== user.uid && !message.readBy.includes(user.uid))
      .map((message) => message.id);

    if (unreadIncomingIds.length === 0) {
      return;
    }

    const batch = writeBatch(firestore);
    unreadIncomingIds.forEach((messageId) => {
      const messageRef = doc(firestore, 'chats', selectedChatId, 'messages', messageId);
      batch.update(messageRef, { readBy: arrayUnion(user.uid) });
    });
    void batch.commit();
  }, [firestore, isMobile, isMobileDialogOpen, messages, selectedChatId, user]);
  // Initial scroll when opening chat: always go to the latest message.
  useEffect(() => {
    if (!selectedChatId || messages.length === 0) {
      return;
    }
    if (lastChatAndMessagesRef.current?.chatId !== selectedChatId) {
      return;
    }
    if (initialScrollDoneForChatRef.current === selectedChatId) {
      return;
    }

    initialScrollDoneForChatRef.current = selectedChatId;
    isAtBottomRef.current = true;
    setIsAtBottom(true);

    requestAnimationFrame(() => {
      scrollToBottom('auto');
    });
  }, [selectedChatId, messages, scrollToBottom]);

  useEffect(() => {
    const previousChatId = typingChatIdRef.current;
    if (previousChatId && previousChatId !== selectedChatId) {
      void stopTypingForChat(previousChatId);
    }

    if (!firestore || !user || !selectedChatId) {
      return;
    }

    const hasText = newMessage.trim().length > 0;

    if (!hasText) {
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = null;
      }
      void stopTypingForChat(selectedChatId);
      return;
    }

    if (!isTypingRef.current || typingChatIdRef.current !== selectedChatId) {
      isTypingRef.current = true;
      typingChatIdRef.current = selectedChatId;
      void setTypingStateForChat(selectedChatId, true);
    }

    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
    }

    typingStopTimeoutRef.current = setTimeout(() => {
      void stopTypingForChat(selectedChatId);
    }, 2500);
  }, [firestore, newMessage, selectedChatId, setTypingStateForChat, stopTypingForChat, user]);

  useEffect(() => {
    return () => {
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
      }
      if (typingChatIdRef.current) {
        void stopTypingForChat(typingChatIdRef.current);
      }
    };
  }, [stopTypingForChat]);

  useEffect(() => {
    if (!selectedChatId) {
      initialScrollDoneForChatRef.current = null;
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
    if (!selectedChatId || messages.length === 0 || !isAtBottomRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      scrollToBottom('auto');
    });
  }, [forwardedPostLikesById, profilesById, messages, selectedChatId, scrollToBottom]);

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

  const selectedChatParticipants = useMemo(() => {
    if (!selectedChat) {
      return [] as UserProfile[];
    }

    return selectedChat.participantIds
      .map((participantId) => profilesById[participantId])
      .filter((profile): profile is UserProfile => Boolean(profile));
  }, [profilesById, selectedChat]);

  const isSelectedChatGroup = Boolean(selectedChat && (selectedChat.isGroup || selectedChat.participantIds.length > 2));

  const selectedChatTitle = useMemo(() => {
    if (!selectedChat || !user) {
      return '';
    }

    if (isSelectedChatGroup) {
      if (selectedChat.title?.trim()) {
        return selectedChat.title;
      }

      const memberNames = selectedChat.participantIds
        .filter((id) => id !== user.uid)
        .map((id) => profilesById[id]?.nickname)
        .filter((nickname): nickname is string => Boolean(nickname));

      return memberNames.length > 0 ? memberNames.join(', ') : 'Беседа';
    }

    return selectedPartnerProfile?.nickname || 'Пользователь';
  }, [isSelectedChatGroup, profilesById, selectedChat, selectedPartnerProfile, user]);

  const suggestedGroupParticipants = useMemo(() => {
    if (!user) {
      return [] as UserProfile[];
    }

    const suggestedIds = Array.from(
      new Set(
        chats
          .flatMap((chat) => chat.participantIds)
          .filter((id) => id && id !== user.uid && !selectedGroupMemberIds.includes(id))
      )
    );

    return suggestedIds
      .map((id) => profilesById[id])
      .filter((profile): profile is UserProfile => Boolean(profile));
  }, [chats, profilesById, selectedGroupMemberIds, user]);

  const suggestedInviteParticipants = useMemo(() => {
    if (!selectedChat || !user) {
      return [] as UserProfile[];
    }

    const excludedIds = new Set([user.uid, ...selectedChat.participantIds]);
    const suggestedIds = Array.from(new Set(chats.flatMap((chat) => chat.participantIds).filter((id) => id && !excludedIds.has(id))));

    return suggestedIds
      .map((id) => profilesById[id])
      .filter((profile): profile is UserProfile => Boolean(profile));
  }, [chats, profilesById, selectedChat, user]);

  const invitePickerParticipants = useMemo(() => {
    const uniqueById = new Map<string, UserProfile>();

    suggestedInviteParticipants.forEach((candidate) => {
      uniqueById.set(candidate.id, candidate);
    });

    inviteCandidates.forEach((candidate) => {
      uniqueById.set(candidate.id, candidate);
    });

    return Array.from(uniqueById.values());
  }, [inviteCandidates, suggestedInviteParticipants]);

  const selectedImagePreviews = useMemo(
    () => selectedImages.map((file) => ({ key: `${file.name}-${file.size}-${file.lastModified}`, url: URL.createObjectURL(file) })),
    [selectedImages]
  );

  useEffect(() => {
    return () => {
      selectedImagePreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [selectedImagePreviews]);

  const searchUsers = useCallback(
    async (term: string, excludedIds: string[]) => {
      if (!firestore || !user) {
        return [] as UserProfile[];
      }

      const normalizedTerm = term.trim().toLowerCase();
      if (!normalizedTerm) {
        return [] as UserProfile[];
      }

      const usersSnapshot = await getDocs(query(collection(firestore, 'users')));
      const excluded = new Set(excludedIds);

      return usersSnapshot.docs
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
        .filter((candidate) => !excluded.has(candidate.id) && candidate.nickname.toLowerCase().includes(normalizedTerm))
        .slice(0, 12);
    },
    [firestore, user]
  );

  useEffect(() => {
    if (!isCreateGroupOpen || !isGroupMemberPickerOpen || !user) {
      setGroupSearchResults([]);
      setGroupSearchLoading(false);
      return;
    }

    const trimmed = groupSearchTerm.trim();
    if (trimmed.length < 2) {
      setGroupSearchResults([]);
      setGroupSearchLoading(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setGroupSearchLoading(true);
      try {
        const found = await searchUsers(trimmed, [user.uid, ...selectedGroupMemberIds]);
        setGroupSearchResults(found);
      } finally {
        setGroupSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [groupSearchTerm, isCreateGroupOpen, isGroupMemberPickerOpen, searchUsers, selectedGroupMemberIds, user]);

  useEffect(() => {
    if (!isInviteOpen || !selectedChat || !user) {
      setInviteSearchResults([]);
      setInviteSearchLoading(false);
      return;
    }

    const trimmed = inviteSearchTerm.trim();
    if (trimmed.length < 2) {
      setInviteSearchResults([]);
      setInviteSearchLoading(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setInviteSearchLoading(true);
      try {
        const found = await searchUsers(trimmed, [user.uid, ...selectedChat.participantIds]);
        setInviteSearchResults(found);
      } finally {
        setInviteSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [inviteSearchTerm, isInviteOpen, searchUsers, selectedChat, user]);

  useEffect(() => {
    if (!isInviteOpen || !selectedChat || !user || !firestore) {
      setInviteCandidates([]);
      setInviteCandidatesLoading(false);
      return;
    }

    let isActive = true;
    void (async () => {
      setInviteCandidatesLoading(true);
      try {
        const excludedIds = new Set([user.uid, ...selectedChat.participantIds]);
        const usersSnapshot = await getDocs(query(collection(firestore, 'users')));
        const candidates = usersSnapshot.docs
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
          .filter((candidate) => !excludedIds.has(candidate.id))
          .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ru'))
          .slice(0, 20);

        if (isActive) {
          setInviteCandidates(candidates);
        }
      } finally {
        if (isActive) {
          setInviteCandidatesLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [firestore, isInviteOpen, selectedChat, user]);

  const createGroupChat = async () => {
    if (!firestore || !user || selectedGroupMemberIds.length === 0) {
      return;
    }

    setIsCreatingGroup(true);
    try {
      const uniqueParticipantIds = Array.from(new Set([user.uid, ...selectedGroupMemberIds]));
      const chatRef = await addDoc(collection(firestore, 'chats'), {
        participantIds: uniqueParticipantIds,
        isGroup: true,
        title: groupTitle.trim(),
        updatedAt: serverTimestamp(),
        lastMessageText: '',
        typingUserIds: [],
      });

      setSelectedChatId(chatRef.id);
      setMobileDialogOpen(true);
      setCreateGroupOpen(false);
      setGroupTitle('');
      setGroupSearchTerm('');
      setGroupSearchResults([]);
      setGroupMemberPickerOpen(false);
      setSelectedGroupMemberIds([]);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const addUserToSelectedChat = async (targetUser: UserProfile) => {
    if (!firestore || !selectedChatId) {
      return;
    }

    await updateDoc(doc(firestore, 'chats', selectedChatId), {
      participantIds: arrayUnion(targetUser.id),
      updatedAt: serverTimestamp(),
    });

    setProfilesById((prev) => ({ ...prev, [targetUser.id]: targetUser }));
    setInviteSearchTerm('');
    setInviteSearchResults([]);
  };

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
        isGroup: false,
        title: '',
        updatedAt: serverTimestamp(),
        lastMessageText: '',
        typingUserIds: [],
      });
    }

    setProfilesById((prev) => ({ ...prev, [targetUser.id]: targetUser }));
    handleSelectChat(chatId);
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

    const forwardedPostPayload = selectedMessages.length === 1 ? selectedMessages[0].forwardedPost ?? null : null;

    const flattenedForwardPayloads = selectedMessages.flatMap((message) => {
      if (message.forwardedPost) {
        return [];
      }

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
      forwardedMessages: flattenedForwardPayloads.length > 0 ? flattenedForwardPayloads : null,
      forwardedMessage: null,
      forwardedPost: forwardedPostPayload,
      createdAt: serverTimestamp(),
      readBy: [user.uid],
      likedBy: [],
    });

    await updateDoc(doc(firestore, 'chats', targetChatId), {
      lastMessageText: `↪ Переслано ${selectedMessages.length}`,
      lastMessageSenderId: user.uid,
      updatedAt: serverTimestamp(),
    });

    await stopTypingForChat(targetChatId);

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

    const sendStartedAt = Date.now();
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
        likedBy: [],
      });

      await updateDoc(doc(firestore, 'chats', targetChatId), {
        lastMessageText: text || (imageUrls.length > 0 ? `📷 ${imageUrls.length}` : '↪ Переслано сообщение'),
        lastMessageSenderId: user.uid,
        updatedAt: serverTimestamp(),
      });

      fetch('https://https://z-xi-plum.vercel.app//api/send-push', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: targetChatId,
          senderId: user.uid,
          text: text || (imageUrls.length > 0 ? '📷 Фотография' : 'Сообщение')
        })
      }).catch(err => console.error('Failed to send push:', err));

      await stopTypingForChat(targetChatId);

      setNewMessage('');
      setSelectedImages([]);
      requestAnimationFrame(() => {
        scrollToBottom('smooth');
      });
    } finally {
      const elapsed = Date.now() - sendStartedAt;
      const spinDurationMs = 2000;
      const remainder = elapsed % spinDurationMs;
      const remaining = remainder === 0 ? 0 : spinDurationMs - remainder;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setSending(false);
    }
  };

  const toggleMessageLike = async (messageId: string, isLiked: boolean) => {
    if (!firestore || !user || !selectedChatId) {
      return;
    }

    setMessageHeartAnimationKeys((current) => ({
      ...current,
      [messageId]: (current[messageId] || 0) + 1,
    }));

    const messageRef = doc(firestore, 'chats', selectedChatId, 'messages', messageId);
    await updateDoc(messageRef, {
      likedBy: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const mergedTypingUserIds = Array.from(new Set([
    ...(selectedChat?.typingUserIds || []),
    ...(selectedChatId ? (typingByChatId[selectedChatId] || []) : []),
  ]));
  const typingUserIdsExceptMe = mergedTypingUserIds.filter((typingUserId) => typingUserId !== user?.uid);
  const isPartnerTyping = Boolean(!isSelectedChatGroup && typingUserIdsExceptMe.length > 0);
  const typingParticipants = typingUserIdsExceptMe
    .map((typingUserId) => profilesById[typingUserId]?.nickname)
    .filter((nickname): nickname is string => Boolean(nickname));
  const groupTypingLabel = typingParticipants.length > 1
    ? `${typingParticipants[0]} и еще ${typingParticipants.length - 1} печатают…`
    : `${typingParticipants[0] || 'Кто-то'} печатает…`;

  return (
    <div className="mx-auto relative flex h-full max-w-5xl">
      <section className={`w-full border-r border-border/50 md:max-w-sm ${isMobile && isMobileDialogOpen ? 'hidden' : 'block'}`}>
        <header
          className="sticky top-0 z-10 border-b border-border/50 bg-background/80 p-4 backdrop-blur-sm"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        >
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Сообщения</h1>
            <Button type="button" size="sm" variant="outline" onClick={() => setCreateGroupOpen(true)} className="gap-1">
              <Users className="h-4 w-4" />
              Беседа
            </Button>
          </div>
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
              const isGroupChat = Boolean(chat.isGroup || chat.participantIds.length > 2);
              const partnerId = user ? chat.participantIds.find((id) => id !== user.uid) : null;
              const partner = partnerId ? profilesById[partnerId] : null;
              const groupMemberNames = chat.participantIds
                .filter((id) => id !== user?.uid)
                .map((id) => profilesById[id]?.nickname)
                .filter((nickname): nickname is string => Boolean(nickname));
              const chatTitle = isGroupChat
                ? chat.title || (groupMemberNames.length > 0 ? groupMemberNames.join(', ') : 'Беседа')
                : partner?.nickname || 'Пользователь';

              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => {
                    handleSelectChat(chat.id);
                  }}
                  className={`mb-1 flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
                    selectedChatId === chat.id ? 'bg-[#577F59] text-white' : 'hover:bg-accent/50'
                  }`}
                >
                  <Avatar className="h-11 w-11">
                    {isGroupChat ? (
                      <AvatarFallback>
                        <Users className="h-5 w-5" />
                      </AvatarFallback>
                    ) : (
                      <>
                        <AvatarImage src={partner?.profilePictureUrl ?? undefined} alt={partner?.nickname || 'User'} />
                        <AvatarFallback>{partner?.nickname?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{chatTitle}</p>
                    <p className={`truncate text-sm ${selectedChatId === chat.id ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {chat.lastMessageText || 'Сообщений пока нет'}
                    </p>
                  </div>
                  {(() => {
                    const count = selectedChatId === chat.id ? 0 : (unreadByChatId[chat.id] ?? 0);
                    return count > 0 ? (
                      <div
                        className="min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-xs font-semibold bg-[#577F59] text-white"
                      >
                        {count}
                      </div>
                    ) : null;
                  })()}
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
          {selectedChat ? (
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {isMobile && (
                  <Button variant="ghost" size="icon" onClick={() => setMobileDialogOpen(false)} className="mr-1">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}
                {isSelectedChatGroup ? (
                  <button type="button" onClick={() => setParticipantsOpen(true)}>
                    <Avatar>
                      <AvatarFallback>
                        <Users className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  </button>
                ) : selectedPartnerProfile ? (
                  <Link href={`/profile?nickname=${selectedPartnerProfile.nickname}`} className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={selectedPartnerProfile.profilePictureUrl ?? undefined} alt={selectedPartnerProfile.nickname} />
                      <AvatarFallback>{selectedPartnerProfile.nickname[0]?.toUpperCase() || '?'}</AvatarFallback>
                    </Avatar>
                  </Link>
                ) : null}
                <div>
                  {isSelectedChatGroup ? (
                    <button type="button" className="font-semibold text-left hover:underline" onClick={() => setParticipantsOpen(true)}>{selectedChatTitle}</button>
                  ) : selectedPartnerProfile ? (
                    <Link href={`/profile?nickname=${selectedPartnerProfile.nickname}`} className="font-semibold hover:underline">
                      {selectedPartnerProfile.nickname}
                    </Link>
                  ) : (
                    <p className="font-semibold">{selectedChatTitle}</p>
                  )}
                  {!isSelectedChatGroup && (
                    isPartnerTyping ? (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <TypingKeyboardIcon />
                        <span>печатает…</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Личные сообщения</p>
                    )
                  )}
                  {isSelectedChatGroup && (
                    <>
                      {typingUserIdsExceptMe.length > 0 ? (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <TypingKeyboardIcon />
                          <span>{groupTypingLabel}</span>
                        </div>
                      ) : (
                        <button type="button" className="mt-1 block text-xs text-muted-foreground hover:underline" onClick={() => setParticipantsOpen(true)}>
                          Участники: {selectedChat?.participantIds.length || 0}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {isSelectedChatGroup && (
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  Пригласить
                </Button>
              )}
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
            (() => {
              const firstUnreadIndex = user
                ? messages.findIndex((m) => m.senderId !== user.uid && !m.readBy.includes(user.uid))
                : -1;
              return messages.map((message, index) => {
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
              const isLikedByMe = message.likedBy.includes(user?.uid || '');
              const likedColorClass = 'text-[#A7BBA9]';
              const messageAuthor = profilesById[message.senderId];
              return (
                <Fragment key={message.id}>
                  {index === firstUnreadIndex && (
                    <div className="flex w-full items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground shrink-0">Новые сообщения</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                <div
                  ref={(element) => {
                    messageElementRefs.current[message.id] = element;
                  }}
                  className={`flex cursor-pointer w-full ${isMine ? 'justify-end' : 'justify-start'}`}
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
                    {isSelectedChatGroup && (
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] opacity-70">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {messageAuthor ? (
                            <>
                              <Link
                                href={`/profile?nickname=${messageAuthor.nickname}`}
                                onClick={(event) => event.stopPropagation()}
                                className="flex-shrink-0"
                              >
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={messageAuthor.profilePictureUrl ?? undefined} alt={messageAuthor.nickname} />
                                  <AvatarFallback className="text-[10px]">{messageAuthor.nickname[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                                </Avatar>
                              </Link>
                              <Link
                                href={`/profile?nickname=${messageAuthor.nickname}`}
                                onClick={(event) => event.stopPropagation()}
                                className="truncate font-medium hover:underline"
                              >
                                @{messageAuthor.nickname}
                              </Link>
                            </>
                          ) : (
                            <>
                              <Avatar className="h-5 w-5 flex-shrink-0">
                                <AvatarFallback className="text-[10px]">?</AvatarFallback>
                              </Avatar>
                              <span className="truncate font-medium">@пользователь</span>
                            </>
                          )}
                        </div>
                        <span className="flex-shrink-0">{formatTime(message.createdAt)}</span>
                      </div>
                    )}

                    {normalizedForwarded.length > 0 && (
                      <div className="mb-2 rounded-md border border-border/60 bg-background/40 p-2 text-xs">
                        <div className="space-y-1">
                          {normalizedForwarded.map((forwarded, idx) => {
                            const prevSenderId = normalizedForwarded[idx - 1]?.senderId;
                            const showSenderLabel = idx === 0 || prevSenderId !== forwarded.senderId;

                            return (
                            <div
                              key={`${forwarded.id}-${forwarded.createdAt}`}
                              role="button"
                              tabIndex={0}
                              className="block w-full cursor-pointer rounded-sm border border-border/40 p-1 text-left transition hover:bg-background/40"
                              onClick={(event) => {
                                event.stopPropagation();
                                scrollToOriginalMessage(forwarded.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  scrollToOriginalMessage(forwarded.id);
                                }
                              }}
                            >
                              {showSenderLabel && (
                                <p className="mb-0.5 text-[11px] opacity-70">
                                  От {profilesById[forwarded.senderId]?.nickname || 'пользователя'}
                                </p>
                              )}
                              {forwarded.text && <p className="line-clamp-2">{forwarded.text}</p>}
                              {forwarded.imageUrls?.length > 0 && (
                                <div
                                  className={`mt-1 grid gap-1 ${forwarded.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {forwarded.imageUrls.map((url, imgIdx) => (
                                    <button
                                      key={`${url}-${imgIdx}`}
                                      type="button"
                                      className={forwarded.imageUrls.length === 1 ? 'w-fit' : ''}
                                      onClick={() => openImageViewer(forwarded.imageUrls!, imgIdx)}
                                    >
                                      <img
                                        src={url}
                                        alt=""
                                        className={`${forwarded.imageUrls!.length === 1 ? 'block max-h-32 max-w-[200px] rounded object-contain' : 'h-20 w-20 rounded object-contain'}`}
                                      />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {message.forwardedPost && (() => {
                      const fp = message.forwardedPost;
                      const postForCard: Post = {
                        id: fp.postId,
                        userId: fp.authorId,
                        caption: fp.caption ?? '',
                        mediaUrls: fp.mediaUrls ?? [],
                        mediaTypes: fp.mediaTypes ?? [],
                        createdAt: message.createdAt,
                        updatedAt: message.createdAt,
                        likedBy: forwardedPostLikesById[fp.postId] || fp.likedBy || [],
                      };
                      return (
                        <div className="mb-2 w-full max-w-[280px]" onClick={(e) => e.stopPropagation()}>
                          <PostCard post={postForCard} />
                        </div>
                      );
                    })()}

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
                              className={`${message.imageUrls.length === 1 ? 'block max-h-48 max-w-[260px] rounded-md object-contain' : 'h-28 w-28 rounded-md object-contain'}`}
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-end gap-2 text-[11px] opacity-70">
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 ${isLikedByMe ? likedColorClass : ''}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void toggleMessageLike(message.id, isLikedByMe);
                        }}
                      >
                        <Heart key={`message-heart-${message.id}-${messageHeartAnimationKeys[message.id] || 0}`} className={`h-3.5 w-3.5 ${(messageHeartAnimationKeys[message.id] || 0) > 0 ? 'heart-like-pop' : ''} ${isLikedByMe ? 'fill-current' : ''}`} />
                        {message.likedBy.length > 0 && <span>{message.likedBy.length}</span>}
                      </button>
                      {!isSelectedChatGroup && <span>{formatTime(message.createdAt)}</span>}
                      {isMine && (isReadByPartner ? <DoubleCheckIcon /> : <SingleCheckIcon />)}
                    </div>
                  </div>
                </div>
                </Fragment>
              );
              });
            })()
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
                placeholder="Написать..."
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
                  ref={messageInputRef}
                  value={newMessage}
                  onChange={(event) => {
                    setNewMessage(event.target.value);
                    requestAnimationFrame(resizeMessageInput);
                  }}
                  placeholder={selectedChatId ? 'Написать...' : 'Сначала выберите диалог'}
                  disabled={!selectedChatId || sending}
                  className="flex-1 min-h-0 resize-none overflow-y-auto border-none bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0 text-sm leading-5"
                  style={{ minHeight: LINE_HEIGHT_PX * MIN_LINES, maxHeight: LINE_HEIGHT_PX * MAX_LINES }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  onPaste={handlePasteImageToMessageInput}
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
                  <AppLoaderIcon className="h-4 w-4 text-primary-foreground" spinning={sending} />
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
              const isGroupChat = Boolean(chat.isGroup || chat.participantIds.length > 2);
              const partnerId = chat.participantIds.find((id) => id !== user?.uid);
              const partner = partnerId ? profilesById[partnerId] : null;
              const chatName = isGroupChat
                ? (chat.title?.trim() || 'Беседа')
                : partner?.nickname || 'Пользователь';

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
                    {isGroupChat ? (
                      <AvatarFallback>
                        <Users className="h-5 w-5" />
                      </AvatarFallback>
                    ) : (
                      <>
                        <AvatarImage src={partner?.profilePictureUrl ?? undefined} alt={partner?.nickname || 'User'} />
                        <AvatarFallback>{partner?.nickname?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  <div>
                    <p className="font-medium">{chatName}</p>
                    <p className="text-xs text-muted-foreground">{chat.lastMessageText || 'Без сообщений'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}


      <Dialog open={isCreateGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Новая беседа</DialogTitle>
          <DialogDescription>Выберите участников и создайте групповой чат.</DialogDescription>

          <div className="space-y-3">
            <Input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} placeholder="Название беседы (необязательно)" />

            <Button type="button" variant="outline" className="w-full justify-start gap-2" onClick={() => setGroupMemberPickerOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Добавить участников
            </Button>

            <div className="max-h-56 space-y-1 overflow-y-auto">
              {selectedGroupMemberIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Участники пока не выбраны.</p>
              ) : (
                selectedGroupMemberIds.map((memberId) => {
                  const member = profilesById[memberId];
                  return (
                    <div key={memberId} className="flex items-center justify-between rounded-md border p-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member?.profilePictureUrl ?? undefined} alt={member?.nickname || 'Участник'} />
                          <AvatarFallback>{(member?.nickname || '?')[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="truncate text-sm">{member?.nickname || memberId}</span>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedGroupMemberIds((prev) => prev.filter((id) => id !== memberId))}>
                        Убрать
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateGroupOpen(false)}>
                Отмена
              </Button>
              <Button type="button" onClick={() => void createGroupChat()} disabled={selectedGroupMemberIds.length === 0 || isCreatingGroup}>
                {isCreatingGroup ? 'Создание...' : 'Создать беседу'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isGroupMemberPickerOpen} onOpenChange={setGroupMemberPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Добавить участников</DialogTitle>
          <DialogDescription>Выберите пользователей для новой беседы.</DialogDescription>

          <div className="max-h-48 space-y-1 overflow-y-auto">
            {suggestedGroupParticipants.length > 0 ? (
              suggestedGroupParticipants.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md border p-2 text-left hover:bg-muted/40"
                  onClick={() => {
                    setSelectedGroupMemberIds((prev) => (prev.includes(candidate.id) ? prev : [...prev, candidate.id]));
                  }}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={candidate.profilePictureUrl ?? undefined} alt={candidate.nickname} />
                    <AvatarFallback>{candidate.nickname[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{candidate.nickname}</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Нет предложенных участников из ваших бесед.</p>
            )}
          </div>

          <Input
            value={groupSearchTerm}
            onChange={(event) => setGroupSearchTerm(event.target.value)}
            placeholder="Найти пользователей (минимум 2 символа)"
          />

          <div className="max-h-64 space-y-1 overflow-y-auto">
            {groupSearchLoading ? (
              <p className="text-sm text-muted-foreground">Поиск...</p>
            ) : groupSearchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пользователи не найдены.</p>
            ) : (
              groupSearchResults.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md border p-2 text-left hover:bg-muted/40"
                  onClick={() => {
                    setProfilesById((prev) => ({ ...prev, [candidate.id]: candidate }));
                    setSelectedGroupMemberIds((prev) => (prev.includes(candidate.id) ? prev : [...prev, candidate.id]));
                  }}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={candidate.profilePictureUrl ?? undefined} alt={candidate.nickname} />
                    <AvatarFallback>{candidate.nickname[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{candidate.nickname}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isParticipantsOpen} onOpenChange={setParticipantsOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>{selectedChatTitle || 'Участники беседы'}</DialogTitle>
          <DialogDescription>Список участников беседы.</DialogDescription>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {selectedChatParticipants.map((member) => (
              <Link
                key={member.id}
                href={`/profile?nickname=${member.nickname}`}
                className="flex items-center gap-3 rounded-md border p-2 hover:bg-muted/40"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={member.profilePictureUrl ?? undefined} alt={member.nickname} />
                  <AvatarFallback>{member.nickname[0]?.toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
                <span className="truncate">{member.nickname}</span>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isInviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Пригласить в беседу</DialogTitle>
          <DialogDescription>Добавьте новых участников в текущую беседу.</DialogDescription>

          <div className="max-h-48 space-y-1 overflow-y-auto">
            {inviteCandidatesLoading ? (
              <p className="text-sm text-muted-foreground">Загружаем список пользователей...</p>
            ) : invitePickerParticipants.length > 0 ? (
              invitePickerParticipants.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md border p-2 text-left hover:bg-muted/40"
                  onClick={() => void addUserToSelectedChat(candidate)}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={candidate.profilePictureUrl ?? undefined} alt={candidate.nickname} />
                    <AvatarFallback>{candidate.nickname[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{candidate.nickname}</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Нет доступных пользователей для приглашения.</p>
            )}
          </div>

          <Input
            value={inviteSearchTerm}
            onChange={(event) => setInviteSearchTerm(event.target.value)}
            placeholder="Найти пользователей (минимум 2 символа)"
          />

          <div className="max-h-64 space-y-1 overflow-y-auto">
            {inviteSearchLoading ? (
              <p className="text-sm text-muted-foreground">Поиск...</p>
            ) : inviteSearchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет пользователей для приглашения.</p>
            ) : (
              inviteSearchResults.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md border p-2 text-left hover:bg-muted/40"
                  onClick={() => void addUserToSelectedChat(candidate)}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={candidate.profilePictureUrl ?? undefined} alt={candidate.nickname} />
                    <AvatarFallback>{candidate.nickname[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{candidate.nickname}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
