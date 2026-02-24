'use client';

import { PostCard } from '@/components/post-card';
import { useFirestore, useUser } from '@/firebase';
import { Post } from '@/types';
import { collection, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

type ChannelInfo = {
  id: string;
  title: string;
  avatarUrl?: string;
};

export default function FeedPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [regularPosts, setRegularPosts] = useState<Post[]>([]);
  const [channelPosts, setChannelPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const postsCol = collection(firestore, 'posts');
    const feedPostsQuery = query(postsCol, orderBy('createdAt', 'desc'));

    const channelsCol = collection(firestore, 'channels');
    const subscribedChannelsQuery = query(channelsCol, where('subscriberIds', 'array-contains', user.uid));

    const postsUnsubscribe = onSnapshot(
      feedPostsQuery,
      (snapshot) => {
        const postList = snapshot.docs.map((postDoc) => {
          const data = postDoc.data();
          const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString();
          const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date().toISOString();

          return {
            ...data,
            id: postDoc.id,
            createdAt,
            updatedAt,
            likedBy: data.likedBy || [],
            sourceType: 'feed',
          } as Post;
        });

        setRegularPosts(postList);
      },
      (error) => {
        console.error('Feed listener error:', error);
      }
    );

    const channelPostUnsubscribers = new Map<string, () => void>();
    const channelsUnsubscribe = onSnapshot(
      subscribedChannelsQuery,
      (snapshot) => {
        const channelInfos = snapshot.docs.map((channelDoc) => ({
          id: channelDoc.id,
          title: (channelDoc.data().title as string) || 'Канал',
          avatarUrl: (channelDoc.data().avatarUrl as string) || '',
        })) as ChannelInfo[];

        const nextIds = new Set(channelInfos.map((channel) => channel.id));

        for (const [channelId, unsub] of channelPostUnsubscribers.entries()) {
          if (!nextIds.has(channelId)) {
            unsub();
            channelPostUnsubscribers.delete(channelId);
            setChannelPosts((prev) => prev.filter((post) => post.sourceChannelId !== channelId));
          }
        }

        channelInfos.forEach((channel) => {
          if (channelPostUnsubscribers.has(channel.id)) {
            return;
          }

          const channelPostsRef = collection(firestore, 'channels', channel.id, 'posts');
          const channelPostsQuery = query(channelPostsRef, orderBy('createdAt', 'desc'));

          const unsub = onSnapshot(channelPostsQuery, (channelPostsSnapshot) => {
            const mapped = channelPostsSnapshot.docs.map((postDoc) => {
              const data = postDoc.data();
              const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString();
              const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : createdAt;

              return {
                id: `channel_${channel.id}_${postDoc.id}`,
                sourcePostId: postDoc.id,
                sourceType: 'channel',
                sourceChannelId: channel.id,
                sourceChannelTitle: channel.title,
                sourceChannelAvatarUrl: channel.avatarUrl || '',
                userId: data.authorId || channel.id,
                caption: data.text || '',
                mediaUrls: data.imageUrls || [],
                mediaTypes: Array((data.imageUrls || []).length).fill('image'),
                createdAt,
                updatedAt,
                likedBy: data.likedBy || [],
              } as Post;
            });

            setChannelPosts((prev) => {
              const filtered = prev.filter((post) => post.sourceChannelId !== channel.id);
              return [...filtered, ...mapped];
            });
          });

          channelPostUnsubscribers.set(channel.id, unsub);
        });

        setLoading(false);
      },
      (error) => {
        console.error('Subscribed channels listener error:', error);
        setLoading(false);
      }
    );

    return () => {
      postsUnsubscribe();
      channelsUnsubscribe();
      for (const unsub of channelPostUnsubscribers.values()) {
        unsub();
      }
    };
  }, [firestore, user]);

  const posts = useMemo(
    () => [...regularPosts, ...channelPosts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [channelPosts, regularPosts]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-border/50 p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <h1 className="text-xl font-bold">Лента</h1>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col h-full bg-card rounded-lg overflow-hidden border">
              <Skeleton className="aspect-square w-full" />
              <div className="p-3 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center gap-3 mt-auto">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="border-b border-border/50 p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <h1 className="text-xl font-bold">Лента</h1>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      {posts.length === 0 && !loading && (
        <div className="p-8 text-center text-muted-foreground mt-10">
          <p>Здесь пока тихо...</p>
          <p className="text-sm">Создайте первую запись!</p>
        </div>
      )}
    </div>
  );
}
