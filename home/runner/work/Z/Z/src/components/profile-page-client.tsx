'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserProfile, Post } from "@/types";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { PostCard } from "@/components/post-card";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFirestore, useUser } from "@/firebase";

export default function ProfilePageClient({ nickname }: { nickname: string }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [userFound, setUserFound] = useState(true);
    const firestore = useFirestore();
    const { user: authUser } = useUser();

    useEffect(() => {
        if (!nickname || !firestore || !authUser) {
            setLoading(false);
            if (!nickname) setUserFound(false);
            return;
        };

        const getUserByNickname = async (nick: string): Promise<UserProfile | null> => {
            if (!firestore) return null;
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where('nickname', '==', nick), limit(1));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                return null;
            }
            const doc = querySnapshot.docs[0];
            const data = doc.data();
            const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
                ? data.createdAt.toDate().toISOString()
                : new Date().toISOString();
            return {
                ...data,
                id: doc.id,
                createdAt: createdAt,
            } as UserProfile;
        }

        const getPostsByUser = async (userId: string): Promise<Post[]> => {
            if (!firestore) return [];
            const postsRef = collection(firestore, 'posts');
            const q = query(postsRef, where('userId', '==', userId));
            const querySnapshot = await getDocs(q);
            const posts = querySnapshot.docs.map(doc => {
                const data = doc.data();
                const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
                    ? data.createdAt.toDate().toISOString()
                    : new Date().toISOString();
                const updatedAt = data.updatedAt && typeof data.updatedAt.toDate === 'function'
                    ? data.updatedAt.toDate().toISOString()
                    : new Date().toISOString();
                return {
                    ...data,
                    id: doc.id,
                    createdAt: createdAt,
                    updatedAt: updatedAt,
                } as Post;
            });
            posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            return posts;
        }

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


    if (loading) {
        return (
            <div className="overflow-y-auto h-screen">
                <header className="p-4 border-b border-border/50">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-20 w-20 rounded-full" />
                        <div className="flex-grow">
                            <Skeleton className="h-8 w-48 mb-2" />
                             <div className="flex gap-4 text-muted-foreground mt-2">
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-6 w-24" />
                            </div>
                        </div>
                         <Skeleton className="h-10 w-24" />
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

    return (
        <div className="overflow-y-auto h-screen">
            <header className="p-4 border-b border-border/50">
                <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={user.profilePictureUrl ?? undefined} alt={user.nickname} />
                        <AvatarFallback>{user.nickname[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-grow">
                        <h1 className="text-2xl font-bold">{user.nickname}</h1>
                        <div className="flex flex-wrap items-center gap-4 text-muted-foreground mt-2">
                            <span><span className="font-bold text-foreground">{posts.length}</span> Публикации</span>
                            <span><span className="font-bold text-foreground">{followerCount}</span> Подписчики</span>
                            <span><span className="font-bold text-foreground">{followingCount}</span> Подписки</span>
                        </div>
                    </div>
                    <Button variant="outline">Подписаться</Button>
                </div>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 p-1 mt-4">
                {posts.length > 0 ? (
                    posts.map(post => (
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
