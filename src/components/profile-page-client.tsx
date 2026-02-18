'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserProfile, Post } from "@/types";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { PostCard } from "@/components/post-card";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFirestore, useUser } from "@/firebase";
import { useSearchParams } from "next/navigation";

export default function ProfilePageClient() {
    const searchParams = useSearchParams();
    const nickname = searchParams.get('nickname'); 

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
                    likedBy: data.likedBy || [],
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

    return (
        <div className="overflow-y-auto h-screen">
            <header className="p-4 border-b border-border/50">
                {/* 
                   ИЗМЕНЕНИЯ ЗДЕСЬ:
                   1. flex-col для мобильных, md:flex-row для десктопа
                   2. Аватар и Инфо обернуты в div, чтобы быть рядом на мобильном
                   3. Кнопка вынесена и растягивается на мобильном
                */}
                <div className="flex flex-col md:flex-row gap-4 md:items-center">
                    
                    {/* Верхняя часть (Аватар + Ник/Статистика) */}
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
                        </div>
                    </div>

                    {/* Кнопка (Внизу на моб, справа на десктопе) */}
                    <Button variant="outline" className="w-full md:w-auto shrink-0">Подписаться</Button>
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