'use client';

import { Post, UserProfile, Comment } from "@/types";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useAuth } from "@/components/auth-provider";
import { useFirestore } from "@/firebase";
import {
    doc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    collection,
    query,
    orderBy,
    onSnapshot,
    Timestamp,
    getDoc,
    addDoc,
    serverTimestamp
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Heart, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "./ui/textarea";

export function PostView({ post, author }: { post: Post, author: UserProfile | null }) {
    const mediaUrls = post.mediaUrls || [];
    const mediaTypes = post.mediaTypes || [];

    const { user, userProfile } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isLiked, setIsLiked] = React.useState(false);
    const [likeCount, setLikeCount] = React.useState(post.likedBy?.length ?? 0);
    const [comments, setComments] = React.useState<Comment[]>([]);
    const [commentsLoading, setCommentsLoading] = React.useState(true);
    const [newComment, setNewComment] = React.useState('');
    const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [isImageExpanded, setIsImageExpanded] = React.useState(false);

    const mediaUrl = mediaUrls[currentIndex] || null;

    React.useEffect(() => {
        if (user && post.likedBy) {
            setIsLiked(post.likedBy.includes(user.uid));
        }
        setLikeCount(post.likedBy?.length ?? 0);
    }, [post, user]);

    /* ===== LOAD COMMENTS ===== */
    React.useEffect(() => {
        if (!firestore || !post.id) return;

        setCommentsLoading(true);

        const q = query(
            collection(firestore, 'posts', post.id, 'comments'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const d = doc.data();
                const createdAt = d.createdAt instanceof Timestamp
                    ? d.createdAt.toDate().toISOString()
                    : new Date().toISOString();

                return {
                    id: doc.id,
                    ...d,
                    createdAt
                } as Comment;
            });

            const withAuthors = await Promise.all(
                data.map(async (comment) => {
                    if (!comment.userId) return comment;

                    const userDoc = await getDoc(doc(firestore, 'users', comment.userId));
                    if (!userDoc.exists()) return comment;

                    return {
                        ...comment,
                        author: {
                            id: userDoc.id,
                            ...userDoc.data()
                        } as UserProfile
                    };
                })
            );

            setComments(withAuthors);
            setCommentsLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, post.id]);

    /* ===== LIKE ===== */
    const handleLike = async () => {
        if (!user || !firestore) return;

        const postRef = doc(firestore, 'posts', post.id);
        const newStatus = !isLiked;

        setIsLiked(newStatus);
        setLikeCount(c => newStatus ? c + 1 : c - 1);

        try {
            await updateDoc(postRef, {
                likedBy: newStatus
                    ? arrayUnion(user.uid)
                    : arrayRemove(user.uid)
            });
        } catch (e: any) {
            toast({
                title: "Ошибка лайка",
                description: e.message,
                variant: "destructive"
            });
        }
    };

    /* ===== ADD COMMENT ===== */
    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newComment.trim()) return;

        setIsSubmittingComment(true);

        try {
            await addDoc(collection(firestore, 'posts', post.id, 'comments'), {
                postId: post.id,
                userId: user.uid,
                text: newComment.trim(),
                createdAt: serverTimestamp()
            });
            setNewComment('');
        } catch (e: any) {
            toast({
                title: "Ошибка комментария",
                description: e.message,
                variant: "destructive"
            });
        } finally {
            setIsSubmittingComment(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-[90vh] w-full max-w-5xl mx-auto rounded-xl overflow-hidden relative bg-[#40594D] border border-border shadow-2xl">

            {/* ===== LEFT IMAGE BLOCK (если есть изображение) ===== */}
            {mediaUrl && mediaTypes[currentIndex] === 'image' && (
                <div className="relative md:w-1/2 w-full flex items-center justify-center bg-black">
                    <Image
                        src={mediaUrl}
                        alt={post.caption || "Изображение"}
                        fill
                        className="object-contain"
                        priority
                        unoptimized
                    />
                </div>
            )}

            {/* ===== RIGHT PANEL ВСЕГДА ===== */}
            <div className="w-full md:w-1/2 flex flex-col bg-card h-full">

                {/* HEADER */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                    {author && (
                        <>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={author.profilePictureUrl || undefined} />
                                    <AvatarFallback>
                                        {author.nickname?.[0].toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                <div>
                                    <Link
                                        href={`/profile/${author.nickname}`}
                                        className="font-bold"
                                    >
                                        @{author.nickname}
                                    </Link>

                                    <p className="text-xs text-muted-foreground">
                                        {post.createdAt
                                            ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ru })
                                            : "только что"}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleLike}
                                className={cn(
                                    "flex items-center gap-2",
                                    isLiked ? "text-primary" : "text-muted-foreground"
                                )}
                            >
                                <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
                                <span>{likeCount}</span>
                            </button>
                        </>
                    )}
                </div>

                {/* CAPTION + COMMENTS */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {post.caption && (
                        <div className="pb-4 border-b border-border">
                            <p className="whitespace-pre-wrap">{post.caption}</p>
                        </div>
                    )}

                    {commentsLoading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin" />
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm">
                            Комментариев пока нет
                        </div>
                    ) : (
                        comments.map(comment => (
                            <div key={comment.id} className="flex gap-3">
                                <Avatar className="h-7 w-7">
                                    <AvatarImage src={comment.author?.profilePictureUrl} />
                                    <AvatarFallback>
                                        {comment.author?.nickname?.[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="bg-muted rounded-xl px-3 py-2 text-sm">
                                    <p className="font-semibold text-xs">
                                        @{comment.author?.nickname || "user"}
                                    </p>
                                    <p>{comment.text}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* COMMENT INPUT */}
                {userProfile && (
                    <div className="p-4 border-t border-border">
                        <form onSubmit={handleCommentSubmit} className="flex gap-2">
                            <Textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Добавить комментарий..."
                                className="min-h-[40px] resize-none text-sm"
                            />
                            <button
                                disabled={!newComment.trim() || isSubmittingComment}
                                className="px-4 bg-primary text-primary-foreground rounded-xl disabled:opacity-50"
                            >
                                {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : "ОК"}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
