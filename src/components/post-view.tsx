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
    addDoc,
    serverTimestamp
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Heart } from "lucide-react";
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
    const [newComment, setNewComment] = React.useState('');
    const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [isImageExpanded, setIsImageExpanded] = React.useState(false);

    const mediaUrl = mediaUrls[currentIndex] || null;
    const hasImage = mediaUrl && mediaTypes[currentIndex] === 'image';

    /* =======================
       LIKE LOGIC
    ======================== */
    React.useEffect(() => {
        if (user && post.likedBy) {
            setIsLiked(post.likedBy.includes(user.uid));
        }
        setLikeCount(post.likedBy?.length ?? 0);
    }, [post, user]);

    const toggleLike = async () => {
        if (!user) return;

        const postRef = doc(firestore, "posts", post.id);

        try {
            if (isLiked) {
                await updateDoc(postRef, {
                    likedBy: arrayRemove(user.uid)
                });
                setLikeCount(prev => prev - 1);
            } else {
                await updateDoc(postRef, {
                    likedBy: arrayUnion(user.uid)
                });
                setLikeCount(prev => prev + 1);
            }

            setIsLiked(!isLiked);
        } catch {
            toast({
                title: "Ошибка",
                description: "Не удалось обновить лайк",
                variant: "destructive"
            });
        }
    };

    /* =======================
       COMMENTS SUBSCRIBE
    ======================== */
    React.useEffect(() => {
        const q = query(
            collection(firestore, "posts", post.id, "comments"),
            orderBy("createdAt", "asc")
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const data: Comment[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Comment[];

            setComments(data);
        });

        return () => unsub();
    }, [firestore, post.id]);

    /* =======================
       ADD COMMENT
    ======================== */
    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !userProfile) return;

        setIsSubmittingComment(true);

        try {
            await addDoc(
                collection(firestore, "posts", post.id, "comments"),
                {
                    text: newComment.trim(),
                    authorId: userProfile.uid,
                    authorNickname: userProfile.nickname,
                    authorProfilePictureUrl: userProfile.profilePictureUrl || null,
                    createdAt: serverTimestamp()
                }
            );

            setNewComment('');
        } catch {
            toast({
                title: "Ошибка",
                description: "Не удалось добавить комментарий",
                variant: "destructive"
            });
        } finally {
            setIsSubmittingComment(false);
        }
    };

    /* =======================
       RENDER
    ======================== */
    return (
        <div className="flex flex-col md:flex-row h-[90vh] w-full max-w-5xl mx-auto rounded-xl overflow-hidden bg-[#40594D] border border-border shadow-2xl">

            {/* ===== LEFT COLUMN ===== */}
            <div className="w-full md:w-1/2 flex items-center justify-center p-8 overflow-y-auto">
                {hasImage ? (
                    <div
                        className="relative w-full h-full flex items-center justify-center cursor-pointer"
                        onClick={() => setIsImageExpanded(!isImageExpanded)}
                    >
                        <Image
                            src={mediaUrl}
                            alt={post.caption || "Изображение"}
                            fill
                            className="object-contain"
                            priority
                            unoptimized
                        />
                    </div>
                ) : (
                    <div className="w-full max-w-2xl">
                        {post.caption && (
                            <p className="text-lg whitespace-pre-wrap leading-relaxed text-white">
                                {post.caption}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* ===== RIGHT COLUMN ===== */}
            <div className="w-full md:w-1/2 flex flex-col bg-card h-full">

                {/* HEADER */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                    {author && (
                        <>
                            <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={author.profilePictureUrl || undefined} />
                                    <AvatarFallback>
                                        {author.nickname?.[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                <div>
                                    <Link
                                        href={`/profile/${author.nickname}`}
                                        className="font-bold hover:text-primary"
                                    >
                                        @{author.nickname}
                                    </Link>

                                    <p className="text-xs text-muted-foreground mt-1">
                                        {post.createdAt
                                            ? formatDistanceToNow(
                                                new Date(post.createdAt),
                                                { addSuffix: true, locale: ru }
                                            )
                                            : "только что"}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={toggleLike}
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

                {/* COMMENTS LIST */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={comment.authorProfilePictureUrl || undefined} />
                                <AvatarFallback>
                                    {comment.authorNickname?.[0]?.toUpperCase()}
                                </AvatarFallback>
                            </Avatar>

                            <div className="bg-muted/30 px-3 py-2 rounded-xl max-w-xs">
                                <p className="text-sm font-semibold">
                                    @{comment.authorNickname}
                                </p>
                                <p className="text-sm whitespace-pre-wrap">
                                    {comment.text}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* COMMENT INPUT */}
                {userProfile && (
                    <div className="p-4 border-t border-border">
                        <form onSubmit={handleSubmitComment} className="flex gap-2">
                            <Textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Добавить комментарий..."
                                className="min-h-[40px] resize-none text-sm"
                            />
                            <button
                                type="submit"
                                disabled={isSubmittingComment}
                                className="px-4 bg-primary text-primary-foreground rounded-xl"
                            >
                                OK
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
