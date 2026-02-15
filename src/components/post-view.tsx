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
import { doc, updateDoc, arrayUnion, arrayRemove, collection, query, orderBy, onSnapshot, Timestamp, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Heart, Loader2, Send } from "lucide-react";
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

    React.useEffect(() => {
        if (user && post.likedBy) {
            setIsLiked(post.likedBy.includes(user.uid));
        }
        setLikeCount(post.likedBy?.length ?? 0);
    }, [post, user]);

    /* ===================== ЗАГРУЗКА КОММЕНТАРИЕВ ===================== */
    React.useEffect(() => {
        const q = query(
            collection(firestore, "posts", post.id, "comments"),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: Comment[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<Comment, "id">)
            }));
            setComments(list);
            setCommentsLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, post.id]);

    /* ===================== ОТПРАВКА КОММЕНТАРИЯ ===================== */
    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !user) return;

        try {
            setIsSubmittingComment(true);

            await addDoc(
                collection(firestore, "posts", post.id, "comments"),
                {
                    text: newComment.trim(),
                    userId: user.uid,
                    createdAt: serverTimestamp()
                }
            );

            setNewComment('');
        } catch (error) {
            toast({
                title: "Ошибка",
                description: "Не удалось отправить комментарий",
                variant: "destructive"
            });
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const mediaUrl = mediaUrls[currentIndex] || null;

    return (
        <div className="flex flex-col md:flex-row h-[90vh] w-full max-w-5xl mx-auto rounded-xl overflow-hidden relative bg-[#40594D] border border-border shadow-2xl">

            {/* ===== IMAGE BLOCK ===== */}
            {mediaUrl && mediaTypes[currentIndex] === 'image' && (
                <div
                    className={cn(
                        "relative transition-all duration-500 ease-in-out flex items-center justify-center overflow-hidden",
                        isImageExpanded
                            ? "w-full z-20"
                            : "md:w-1/2 w-full"
                    )}
                >
                    <div
                        className="absolute inset-0 flex items-center justify-center cursor-pointer"
                        onClick={() => setIsImageExpanded(!isImageExpanded)}
                    >
                        <Image
                            src={mediaUrl}
                            alt={post.caption || "Изображение"}
                            fill
                            className="object-contain transition-all duration-500"
                            priority
                            unoptimized
                        />
                    </div>

                    {mediaUrls.length > 1 && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentIndex(i => (i - 1 + mediaUrls.length) % mediaUrls.length);
                                }}
                                className="absolute left-6 top-1/2 -translate-y-1/2 z-30 text-white text-4xl select-none"
                            >
                                ‹
                            </button>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentIndex(i => (i + 1) % mediaUrls.length);
                                }}
                                className="absolute right-6 top-1/2 -translate-y-1/2 z-30 text-white text-4xl select-none"
                            >
                                ›
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ===== RIGHT PANEL ===== */}
            <div
                className={cn(
                    "w-full md:w-1/2 flex flex-col bg-card h-full transition-all duration-500",
                    isImageExpanded && "opacity-0 invisible md:w-0"
                )}
            >
                {/* HEADER */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                    {author && (
                        <>
                            <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="h-10 w-10 ring-1 ring-border flex-shrink-0">
                                    <AvatarImage src={author.profilePictureUrl || undefined} />
                                    <AvatarFallback>
                                        {author.nickname?.[0].toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                <div>
                                    <Link
                                        href={`/profile/${author.nickname}`}
                                        className="font-bold text-foreground hover:text-primary transition-colors"
                                    >
                                        @{author.nickname}
                                    </Link>

                                    <p className="text-xs text-muted-foreground mt-1">
                                        {post.createdAt
                                            ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ru })
                                            : "только что"}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setIsLiked(!isLiked)}
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

                {/* TEXT + COMMENTS (СПРАВА) */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">

                    {post.caption && (
                        <div className="pb-4 border-b border-border">
                            <p className="text-base whitespace-pre-wrap">
                                {post.caption}
                            </p>
                        </div>
                    )}

                    {/* ===== COMMENTS LIST ===== */}
                    {comments.map(comment => (
                        <div key={comment.id} className="text-sm">
                            <span className="font-medium mr-2">
                                {comment.userId}
                            </span>
                            {comment.text}
                        </div>
                    ))}

                </div>

                {/* COMMENT INPUT */}
                {userProfile && (
                    <div className="p-4 border-t border-border">
                        <form onSubmit={handleSubmitComment} className="flex items-center gap-3">
                            <Textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Добавить комментарий..."
                                className="min-h-[40px] resize-none text-sm"
                            />

                            <button
                                type="submit"
                                disabled={!newComment.trim() || isSubmittingComment}
                                className={cn(
                                    "flex items-center justify-center transition",
                                    newComment.trim()
                                        ? "text-primary hover:scale-110"
                                        : "text-muted-foreground cursor-not-allowed"
                                )}
                            >
                                {isSubmittingComment ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Send className="h-5 w-5" />
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
