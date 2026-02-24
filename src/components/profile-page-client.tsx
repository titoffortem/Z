'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Post, UserProfile } from '@/types';
import { updateProfile } from 'firebase/auth';
import { collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ChangeEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PostCard } from '@/components/post-card';
import { useFirestore, useStorage, useUser } from '@/firebase';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

export default function ProfilePageClient() {
  const searchParams = useSearchParams();
  const nickname = searchParams.get('nickname');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFound, setUserFound] = useState(true);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const firestore = useFirestore();
  const storage = useStorage();
  const { user: authUser } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (!nickname || !firestore || !authUser) {
      setLoading(false);
      if (!nickname) setUserFound(false);
      return;
    }

    const getUserByNickname = async (nick: string): Promise<UserProfile | null> => {
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('nickname', '==', nick), limit(1));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return null;
      }
      const userDoc = querySnapshot.docs[0];
      const data = userDoc.data();
      const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString();
      return {
        ...data,
        id: userDoc.id,
        createdAt,
      } as UserProfile;
    };

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

    const fetchData = async () => {
      setLoading(true);
      setUserFound(true);
      const userData = await getUserByNickname(nickname);
      if (userData) {
        setUser(userData);
        const postData = await getPostsByUser(userData.id);
        setPosts(postData);
      } else {
        setUserFound(false);
      }
      setLoading(false);
    };

    fetchData();
  }, [nickname, firestore, authUser]);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !user || !authUser || authUser.uid !== user.id) {
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
      const avatarRef = ref(storage, `avatars/${authUser.uid}/avatar-${Date.now()}`);
      await uploadBytes(avatarRef, file, {
        cacheControl: 'public,max-age=31536000,immutable',
        contentType: file.type,
      });
      const avatarUrl = await getDownloadURL(avatarRef);

      await updateProfile(authUser, { photoURL: avatarUrl });
      await updateDoc(doc(firestore, 'users', authUser.uid), {
        profilePictureUrl: avatarUrl,
        updatedAt: serverTimestamp(),
      });

      setUser((prev) => (prev ? { ...prev, profilePictureUrl: avatarUrl } : prev));
      toast({
        title: 'Готово',
        description: 'Аватар успешно обновлён.',
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

  return (
    <div className="overflow-y-auto h-screen">
      <header className="p-4 border-b border-border/50">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex items-center gap-4 flex-grow">
            <Avatar className="h-20 w-20 shrink-0 border border-border">
              <AvatarImage src={user.profilePictureUrl ?? undefined} alt={user.nickname} />
              <AvatarFallback>{user.nickname[0].toUpperCase()}</AvatarFallback>
            </Avatar>

            <div className="flex flex-col">
              <h1 className="text-2xl font-bold break-all">{user.nickname}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground mt-1 text-sm sm:text-base">
                <span className="whitespace-nowrap"><span className="font-bold text-foreground">{posts.length}</span> Публикации</span>
                <span className="whitespace-nowrap"><span className="font-bold text-foreground">{followerCount}</span> Подписчики</span>
                <span className="whitespace-nowrap"><span className="font-bold text-foreground">{followingCount}</span> Подписки</span>
              </div>
              {isOwnProfile && (
                <div className="mt-3">
                  <label htmlFor="change-avatar" className="text-sm text-primary cursor-pointer hover:underline">
                    {isAvatarUploading ? 'Обновление аватарки...' : 'Сменить аватарку'}
                  </label>
                  <input
                    id="change-avatar"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                    disabled={isAvatarUploading}
                  />
                </div>
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
    </div>
  );
}
