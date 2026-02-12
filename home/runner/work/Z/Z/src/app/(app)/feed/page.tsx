'use client';

import { PostCard } from "@/components/post-card";
import { useFirestore, useUser } from "@/firebase";
import { Post } from "@/types";
import { collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function FeedPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !user) {
            setLoading(false);
            return;
        }
        
        setLoading(true);
        const postsCol = collection(firestore, 'posts');
        const q = query(postsCol, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const postList = snapshot.docs.map(doc => {
                const data = doc.data();
                const createdAt = data.createdAt instanceof Timestamp
                    ? data.createdAt.toDate().toISOString()
                    : new Date().toISOString();
                const updatedAt = data.updatedAt instanceof Timestamp
                    ? data.updatedAt.toDate().toISOString()
                    : new Date().toISOString();
                return {
                    ...data,
                    id: doc.id,
                    createdAt,
                    updatedAt,
                } as Post;
            });
            setPosts(postList);
            setLoading(false);
        }, (error) => {
            console.error("Feed listener error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, user]);

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
        )
    }

    return (
        <div className="mx-auto max-w-7xl">
            <header className="border-b border-border/50 p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                <h1 className="text-xl font-bold">Лента</h1>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4">
                {posts.map(post => (
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
