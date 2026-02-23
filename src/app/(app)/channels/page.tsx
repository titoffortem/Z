'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useFirestore } from '@/firebase';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Megaphone, Plus, Search } from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import type { UserProfile } from '@/types';

type ChannelItem = {
  id: string;
  title: string;
  creatorId: string;
  updatedAt: string;
  lastPostText: string;
};

type ChannelPost = {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
};

const toIsoDate = (value: unknown) => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return new Date().toISOString();
};

const formatTime = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function ChannelsPage() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();

  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, UserProfile>>({});

  const [channelsLoading, setChannelsLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);

  const [channelTitle, setChannelTitle] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [channelSearchTerm, setChannelSearchTerm] = useState('');
  const [channelSearchLoading, setChannelSearchLoading] = useState(false);
  const [channelSearchResults, setChannelSearchResults] = useState<ChannelItem[]>([]);
  const [postText, setPostText] = useState('');
  const [sendingPost, setSendingPost] = useState(false);
  const [createChannelError, setCreateChannelError] = useState<string | null>(null);

  const postsContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    const container = postsContainerRef.current;
    if (!container) {
      return;
    }
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!firestore) {
      return;
    }

    const channelsRef = collection(firestore, 'channels');
    const channelsQuery = query(channelsRef, orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(
      channelsQuery,
      (snapshot) => {
        const nextChannels = snapshot.docs.map((channelDoc) => {
          const data = channelDoc.data();
          return {
            id: channelDoc.id,
            title: data.title || 'Канал',
            creatorId: data.creatorId || '',
            updatedAt: toIsoDate(data.updatedAt),
            lastPostText: data.lastPostText || '',
          } as ChannelItem;
        });

        setChannels(nextChannels);
        setChannelsLoading(false);
      },
      () => setChannelsLoading(false)
    );

    return () => unsubscribe();
  }, [firestore]);

  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  useEffect(() => {
    if (!firestore || !selectedChannelId) {
      setPosts([]);
      return;
    }

    setPostsLoading(true);
    const postsRef = collection(firestore, 'channels', selectedChannelId, 'posts');
    const postsQuery = query(postsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const nextPosts = snapshot.docs.map((postDoc) => {
          const data = postDoc.data();
          return {
            id: postDoc.id,
            authorId: data.authorId || '',
            text: data.text || '',
            createdAt: toIsoDate(data.createdAt),
          } as ChannelPost;
        });

        setPosts(nextPosts);
        setPostsLoading(false);
        requestAnimationFrame(scrollToBottom);
      },
      () => setPostsLoading(false)
    );

    return () => unsubscribe();
  }, [firestore, selectedChannelId]);

  useEffect(() => {
    if (!firestore) {
      return;
    }

    const authorIds = Array.from(
      new Set([...channels.map((channel) => channel.creatorId), ...posts.map((post) => post.authorId)].filter(Boolean))
    );

    if (authorIds.length === 0) {
      return;
    }

    Promise.all(
      authorIds.map(async (authorId) => {
        const profileDoc = await getDoc(doc(firestore, 'users', authorId));
        if (!profileDoc.exists()) {
          return null;
        }

        const data = profileDoc.data();
        return {
          id: profileDoc.id,
          nickname: data.nickname || 'Пользователь',
          profilePictureUrl: data.profilePictureUrl || null,
          createdAt: toIsoDate(data.createdAt),
          followingUserIds: data.followingUserIds || [],
          followerUserIds: data.followerUserIds || [],
        } as UserProfile;
      })
    ).then((profiles) => {
      const next = profiles.reduce<Record<string, UserProfile>>((acc, profile) => {
        if (profile) {
          acc[profile.id] = profile;
        }
        return acc;
      }, {});

      setProfilesById((prev) => ({ ...prev, ...next }));
    });
  }, [channels, firestore, posts]);


  useEffect(() => {
    const trimmed = channelSearchTerm.trim();
    if (!trimmed || trimmed.length < 2) {
      setChannelSearchResults([]);
      setChannelSearchLoading(false);
      return;
    }

    setChannelSearchLoading(true);
    const timeout = setTimeout(() => {
      const normalized = trimmed.toLowerCase();
      const found = channels
        .filter((channel) => channel.title.toLowerCase().includes(normalized))
        .slice(0, 8);

      setChannelSearchResults(found);
      setChannelSearchLoading(false);
    }, 250);

    return () => clearTimeout(timeout);
  }, [channelSearchTerm, channels]);

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) || null,
    [channels, selectedChannelId]
  );

  const exactSearchChannel = channelSearchResults.find((channel) => channel.title.trim().toLowerCase() === channelSearchTerm.trim().toLowerCase()) || null;

  const canPost = Boolean(user && selectedChannel && selectedChannel.creatorId === user.uid);

  const createOrOpenChannel = async (rawTitle: string) => {
    const title = rawTitle.trim();
    if (!firestore || !user || !title) {
      return;
    }

    const existing = channels.find((channel) => channel.title.trim().toLowerCase() === title.toLowerCase());
    if (existing) {
      setSelectedChannelId(existing.id);
      setCreateChannelError(null);
      setChannelSearchTerm('');
      setChannelSearchResults([]);
      return;
    }

    setCreatingChannel(true);
    setCreateChannelError(null);
    try {
      const channelRef = await addDoc(collection(firestore, 'channels'), {
        title,
        creatorId: user.uid,
        updatedAt: serverTimestamp(),
        lastPostText: '',
      });

      const optimisticChannel: ChannelItem = {
        id: channelRef.id,
        title,
        creatorId: user.uid,
        updatedAt: new Date().toISOString(),
        lastPostText: '',
      };

      setChannels((prev) => (prev.some((channel) => channel.id === optimisticChannel.id) ? prev : [optimisticChannel, ...prev]));
      if (userProfile) {
        setProfilesById((prev) => ({ ...prev, [user.uid]: userProfile }));
      }

      setChannelTitle('');
      setChannelSearchTerm('');
      setChannelSearchResults([]);
      setSelectedChannelId(channelRef.id);
    } catch {
      setCreateChannelError('Не удалось создать канал. Попробуйте снова.');
    } finally {
      setCreatingChannel(false);
    }
  };

  const sendPost = async () => {
    const text = postText.trim();
    if (!firestore || !user || !selectedChannel || !text || selectedChannel.creatorId !== user.uid) {
      return;
    }

    setSendingPost(true);
    try {
      await addDoc(collection(firestore, 'channels', selectedChannel.id, 'posts'), {
        authorId: user.uid,
        text,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(firestore, 'channels', selectedChannel.id), {
        lastPostText: text,
        updatedAt: serverTimestamp(),
      });

      setPostText('');
      requestAnimationFrame(scrollToBottom);
    } finally {
      setSendingPost(false);
    }
  };

  return (
    <div className="mx-auto relative flex h-full max-w-6xl">
      <section className="w-full border-r border-border/50 md:max-w-sm">
        <header
          className="sticky top-0 z-10 border-b border-border/50 bg-background/80 p-4 backdrop-blur-sm"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        >
          <h1 className="text-xl font-bold">Каналы</h1>
          <div className="mt-3 flex gap-2">
            <Input value={channelTitle} onChange={(event) => setChannelTitle(event.target.value)} placeholder="Название канала" />
            <Button type="button" onClick={() => void createOrOpenChannel(channelTitle)} disabled={!channelTitle.trim() || creatingChannel}>
              {creatingChannel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>

          {createChannelError && <p className="mt-2 text-xs text-destructive">{createChannelError}</p>}

          <div className="relative mt-3">
            {channelSearchLoading ? (
              <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : (
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            )}
            <Input
              value={channelSearchTerm}
              onChange={(event) => setChannelSearchTerm(event.target.value)}
              className="pl-10"
              placeholder="Найти канал..."
            />
          </div>
        </header>

        {(channelSearchResults.length > 0 || (channelSearchTerm.trim().length >= 2 && !exactSearchChannel)) && (
          <div className="space-y-1 border-b border-border/50 p-2">
            {channelSearchResults.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => {
                  setSelectedChannelId(channel.id);
                  setChannelSearchTerm('');
                  setChannelSearchResults([]);
                }}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-accent/50"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    <Megaphone className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{channel.title}</span>
              </button>
            ))}
            {channelSearchTerm.trim().length >= 2 && !exactSearchChannel && (
              <Button type="button" variant="outline" className="w-full justify-start gap-2" onClick={() => void createOrOpenChannel(channelSearchTerm)}>
                <Plus className="h-4 w-4" />
                Создать канал «{channelSearchTerm.trim()}»
              </Button>
            )}
          </div>
        )}


        <div className="h-[calc(100%-124px)] overflow-y-auto p-2">
          {channelsLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : channels.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2 p-2 text-center text-muted-foreground">
              <Megaphone className="h-10 w-10 opacity-30" />
              <p>Пока нет каналов</p>
            </div>
          ) : (
            channels.map((channel) => {
              const creator = profilesById[channel.creatorId];
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setSelectedChannelId(channel.id)}
                  className={`mb-1 flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
                    selectedChannelId === channel.id ? 'bg-[#577F59] text-white' : 'hover:bg-accent/50'
                  }`}
                >
                  <Avatar className="h-11 w-11">
                    <AvatarFallback>
                      <Megaphone className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{channel.title}</p>
                    <p className={`truncate text-sm ${selectedChannelId === channel.id ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {channel.lastPostText || 'Постов пока нет'}
                    </p>
                    <p className={`truncate text-xs ${selectedChannelId === channel.id ? 'text-white/70' : 'text-muted-foreground'}`}>
                      Автор: {creator?.nickname || '...'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="flex flex-1 flex-col bg-background">
        <header
          className="sticky top-0 z-10 min-h-[73px] border-b border-border/50 bg-background/80 p-4 backdrop-blur-sm"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        >
          {selectedChannel ? (
            <div>
              <p className="font-semibold">{selectedChannel.title}</p>
              <p className="text-xs text-muted-foreground">Писать может только создатель канала</p>
            </div>
          ) : (
            <p className="text-muted-foreground">Выберите канал</p>
          )}
        </header>

        <div ref={postsContainerRef} className="relative flex-1 space-y-3 overflow-y-auto p-4">
          {!selectedChannelId ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">Откройте канал</div>
          ) : postsLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">Пока нет постов</div>
          ) : (
            posts.map((post) => {
              const author = profilesById[post.authorId];
              return (
                <div key={post.id} className="max-w-[85%] rounded-2xl bg-[#f3f5f3] px-3 py-2 text-[#223524] shadow-sm">
                  <p className="text-xs font-semibold text-[#577F59]">{author?.nickname || 'Автор'}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{post.text}</p>
                  <p className="mt-1 text-[10px] text-[#6f836f]">{formatTime(post.createdAt)}</p>
                </div>
              );
            })
          )}
        </div>

        <footer className="border-t border-border/50 bg-background p-4">
          <div className="flex gap-2">
            <Textarea
              value={postText}
              onChange={(event) => setPostText(event.target.value)}
              placeholder={canPost ? 'Написать пост…' : 'Только создатель может публиковать'}
              className="min-h-[44px] max-h-28"
              disabled={!selectedChannelId || !canPost || sendingPost}
            />
            <Button type="button" onClick={() => void sendPost()} disabled={!canPost || !postText.trim() || sendingPost}>
              {sendingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Отправить'}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
