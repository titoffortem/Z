import { PostCard } from "@/components/post-card";
import { db } from "@/lib/firebase";
import { Post } from "@/types";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

export const dynamic = 'force-dynamic';

async function getPosts(): Promise<Post[]> {
    const postsCol = collection(db, 'posts');
    const q = query(postsCol, orderBy('createdAt', 'desc'));
    const postSnapshot = await getDocs(q);
    const postList = postSnapshot.docs.map(doc => {
        const data = doc.data();
        // Timestamps need to be converted to serializable format (string)
        // for Next.js Server Components.
        const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString();
        const updatedAt = data.updatedAt && typeof data.updatedAt.toDate === 'function'
            ? data.updatedAt.toDate().toISOString()
            : new Date().toISOString();
        return {
            ...data,
            id: doc.id,
            createdAt,
            updatedAt,
        } as Post;
    });
    return postList;
}

export default async function FeedPage() {
    const posts = await getPosts();

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
             {posts.length === 0 && (
                <div className="p-8 text-center text-muted-foreground mt-10">
                    <p>Здесь пока тихо...</p>
                    <p className="text-sm">Создайте первую запись!</p>
                </div>
            )}
        </div>
    );
}
