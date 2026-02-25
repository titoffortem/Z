'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { uploadToImageBan } from '@/lib/imageban';
import { Post, UserProfile } from '@/types';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { collection, doc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { ChangeEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PostCard } from '@/components/post-card';
import { useFirestore, useUser } from '@/firebase';
import { getPresenceLabel, toOptionalIsoDate } from '@/lib/presence';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
export default function ProfilePageClient() {
  const searchParams = useSearchParams();
  const nickname = searchParams.get('nickname');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFound, setUserFound] = useState(true);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);
  const [avatarViewerIndex, setAvatarViewerIndex] = useState(0);
  const [presenceNowMs, setPresenceNowMs] = useState(() => Date.now());
  const firestore = useFirestore();
  const { user: authUser } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (!nickname || !firestore || !authUser) {
      setLoading(false);
      if (!nickname) setUserFound(false);
      return;
    }

    const getPostsByUser = async (userId: string): Promise<Post[]> => {
      const postsRef = collection(firestore, 'posts');
      const q = query(postsRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const userPosts = querySnapshot.docs.map((postDoc) => {
        const data = postDoc.data();
        const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate().toISOString()
          : new Date().toISOString();
        const updatedAt = data.updatedAt && typeof data.updatedAt.toDate === 'function'
          ? data.updatedAt.toDate().toISOString()
          : new Date().toISOString();
        return {
          ...data,
          id: postDoc.id,
          createdAt,
          updatedAt,
          likedBy: data.likedBy || [],
        } as Post;
      });
      userPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return userPosts;
    };

    const usersRef = collection(firestore, 'users');
    const userQuery = query(usersRef, where('nickname', '==', nickname), limit(1));

    const unsubscribe = onSnapshot(userQuery, async (snapshot) => {
      if (snapshot.empty) {
        setUser(null);
        setUserFound(false);
        setLoading(false);
        return;
      }

      const userDoc = snapshot.docs[0];
      const data = userDoc.data();
      const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString();

      const userData = {
        ...data,
        id: userDoc.id,
        createdAt,
        isOnline: Boolean(data.isOnline),
        lastSeenAt: toOptionalIsoDate(data.lastSeenAt),
      } as UserProfile;

      setUser(userData);
      setUserFound(true);

      const postData = await getPostsByUser(userData.id);
      setPosts(postData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [nickname, firestore, authUser]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPresenceNowMs(Date.now());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const getAvatarHistory = (profile: UserProfile | null): string[] => {
    if (!profile) {
      return [];
    }

    const fromHistory = (profile.avatarHistoryUrls ?? []).filter((url) => typeof url === 'string' && url.length > 0);
    const fallbackCurrent = profile.profilePictureUrl ? [profile.profilePictureUrl] : [];
    return Array.from(new Set([...fromHistory, ...fallbackCurrent]));
  };

  const avatarHistory = getAvatarHistory(user);

  const openAvatarViewer = () => {
    if (avatarHistory.length === 0) {
      return;
    }

    setAvatarViewerIndex(0);
    setIsAvatarViewerOpen(true);
  };

  const showPreviousAvatar = () => {
    if (avatarHistory.length <= 1) {
      return;
    }

    setAvatarViewerIndex((prev) => (prev - 1 + avatarHistory.length) % avatarHistory.length);
  };

  const showNextAvatar = () => {
    if (avatarHistory.length <= 1) {
      return;
    }

    setAvatarViewerIndex((prev) => (prev + 1) % avatarHistory.length);
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !user || !authUser || authUser.uid !== user.id || isAvatarUploading) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Неверный формат',
        description: 'Можно загружать только изображения.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast({
        title: 'Файл слишком большой',
        description: 'Размер аватарки должен быть до 5 МБ.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsAvatarUploading(true);
      const avatarUrl = await uploadToImageBan(file);

      if (!avatarUrl) {
        throw new Error('Не удалось загрузить изображение аватарки.');
      }

      const previousHistory = getAvatarHistory(user);
      const nextAvatarHistory = Array.from(new Set([avatarUrl, ...previousHistory]));

      await updateProfile(authUser, { photoURL: avatarUrl });
      await updateDoc(doc(firestore, 'users', authUser.uid), {
        profilePictureUrl: avatarUrl,
        avatarHistoryUrls: nextAvatarHistory,
        updatedAt: serverTimestamp(),
        likedBy: [],
      });

      const avatarPostId = doc(collection(firestore, 'posts')).id;
      await setDoc(doc(firestore, 'posts', avatarPostId), {
        id: avatarPostId,
        userId: authUser.uid,
        caption: 'Обновил(а) аватарку',
        mediaUrls: [avatarUrl],
        mediaTypes: ['image'],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        likedBy: [],
      });

      const nowIso = new Date().toISOString();

      setUser((prev) => (prev ? { ...prev, profilePictureUrl: avatarUrl, avatarHistoryUrls: nextAvatarHistory } : prev));
      setPosts((prev) => ([{
        id: avatarPostId,
        userId: authUser.uid,
        caption: 'Обновил(а) аватарку',
        mediaUrls: [avatarUrl],
        mediaTypes: ['image'],
        createdAt: nowIso,
        updatedAt: nowIso,
        likedBy: [],
      }, ...prev]));
      toast({
        title: 'Готово',
        description: 'Аватар успешно обновлён, и создан пост с новой аватаркой.',
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка обновления аватарки',
        description: error?.message ?? 'Не удалось обновить аватар.',
        variant: 'destructive',
      });
    } finally {
      setIsAvatarUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="overflow-y-auto h-screen">
        <header className="p-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row gap-4 md:items-center">
            <div className="flex items-center gap-4 flex-grow">
              <Skeleton className="h-20 w-20 rounded-full shrink-0" />
              <div className="flex-grow space-y-2">
                <Skeleton className="h-8 w-32 md:w-48" />
                <div className="flex flex-wrap gap-3 mt-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            </div>
            <Skeleton className="h-10 w-full md:w-32" />
          </div>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 p-1 mt-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!userFound) {
    return (
      <div className="p-8 text-center text-muted-foreground mt-10 col-span-full">
        <h2 className="text-xl font-semibold text-foreground">Пользователь не найден</h2>
        <p>Профиль с таким никнеймом не существует.</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const followerCount = user.followerUserIds?.length ?? 0;
  const followingCount = user.followingUserIds?.length ?? 0;
  const isOwnProfile = authUser?.uid === user.id;
  const presenceLabel = getPresenceLabel(user.isOnline, user.lastSeenAt, presenceNowMs);

  return (
    <div className="overflow-y-auto h-screen">
      <header className="p-4 border-b border-border/50">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex items-center gap-4 flex-grow">
            <div className="relative h-20 w-20 shrink-0">
              <Avatar className="h-20 w-20 border border-border cursor-pointer" onClick={openAvatarViewer}>
                <AvatarImage src={user.profilePictureUrl ?? undefined} alt={user.nickname} />
                <AvatarFallback>{user.nickname[0].toUpperCase()}</AvatarFallback>
              </Avatar>

              {isOwnProfile && (
                <>
                  <label
                    htmlFor="change-avatar"
                    className={`absolute -bottom-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md transition-opacity ${isAvatarUploading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:opacity-90'}`}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </label>
                  <input
                    id="change-avatar"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                    disabled={isAvatarUploading}
                  />
                </>
              )}
            </div>

            <div className="flex flex-col">
              <h1 className="text-2xl font-bold break-all">{user.nickname}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground mt-1 text-sm sm:text-base">
                <span className="whitespace-nowrap"><span className="font-bold text-foreground">{posts.length}</span> Публикации</span>
                <span className="whitespace-nowrap"><span className="font-bold text-foreground">{followerCount}</span> Подписчики</span>
                <span className="whitespace-nowrap"><span className="font-bold text-foreground">{followingCount}</span> Подписки</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{presenceLabel}</p>
              {isOwnProfile && isAvatarUploading && (
                <p className="mt-3 text-sm text-primary">Обновление аватарки...</p>
              )}
            </div>
          </div>

          <Button variant="outline" className="w-full md:w-auto shrink-0" disabled={isOwnProfile}>
            {isOwnProfile ? 'Это ваш профиль' : 'Подписаться'}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 p-1 mt-4">
        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        ) : (
          <div className="p-8 text-center text-muted-foreground col-span-full">
            <p>Этот пользователь еще ничего не опубликовал.</p>
          </div>
        )}
      </div>

      {isAvatarViewerOpen && avatarHistory.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
          <button type="button" onClick={() => setIsAvatarViewerOpen(false)} className="absolute right-4 top-4 rounded-full bg-background/70 p-2 text-foreground">
            <X className="h-5 w-5" />
          </button>

          {avatarHistory.length > 1 && (
            <button type="button" onClick={showPreviousAvatar} className="absolute left-4 rounded-full bg-background/70 p-2 text-foreground">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          <img
            src={avatarHistory[avatarViewerIndex]}
            alt={`Аватар ${avatarViewerIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
          />

          {avatarHistory.length > 1 && (
            <button type="button" onClick={showNextAvatar} className="absolute right-4 rounded-full bg-background/70 p-2 text-foreground">
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
