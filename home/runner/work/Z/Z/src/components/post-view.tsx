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
import { Button } from "./ui/button";
import { Heart, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "./ui/textarea";
import { Skeleton } from "./ui/skeleton";


function getLikeText(count: number): string {
    if (count % 10 === 1 && count % 100 !== 11) {
        return 'лайк';
    }
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
        return 'лайка';
    }
    return 'лайков';
}

export function PostView({ post, author }: { post: Post, author: UserProfile | null }) {
    const mediaUrl = post.mediaUrls && post.mediaUrls[0];
    const mediaType = post.mediaTypes && post.mediaTypes[0];

    const { user, userProfile } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isLiked, setIsLiked] = React.useState(false);
    const [likeCount, setLikeCount] = React.useState(post.likedBy?.length ?? 0);
    const [comments, setComments] = React.useState<Comment[]>([]);
    const [commentsLoading, setCommentsLoading] = React.useState(true);
    const [newComment, setNewComment] = React.useState('');
    const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);

    React.useEffect(() => {
        if (user && post.likedBy) {
            setIsLiked(post.likedBy.includes(user.uid));
        }
        setLikeCount(post.likedBy?.length ?? 0);
    }, [post, user]);

    React.useEffect(() => {
        if (!firestore || !post.id) return;

        setCommentsLoading(true);
        const commentsQuery = query(collection(firestore, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
        
        const unsubscribe = onSnapshot(commentsQuery, async (snapshot) => {
            const commentsData = snapshot.docs.map(doc => {
                const data = doc.data();
                const createdAt = data.createdAt instanceof Timestamp 
                    ? data.createdAt.toDate().toISOString() 
                    : new Date().toISOString();
                return {
                    id: doc.id,
                    ...data,
                    createdAt,
                } as Comment;
            });

            const commentsWithAuthors = await Promise.all(commentsData.map(async (comment) => {
                if (!comment.userId) return comment;
                try {
                    const userDoc = await getDoc(doc(firestore, 'users', comment.userId));
                    if (userDoc.exists()) {
                        const authorData = userDoc.data();
                        const profile : UserProfile = {
                            id: userDoc.id,
                            nickname: authorData.nickname,
                            profilePictureUrl: authorData.profilePictureUrl,
                            createdAt: authorData.createdAt?.toDate ? authorData.createdAt.toDate().toISOString() : new Date().toISOString(),
                            followingUserIds: authorData.followingUserIds || [],
                            followerUserIds: authorData.followerUserIds || [],
                        }
                        return { ...comment, author: profile };
                    }
                } catch (e) {
                    console.error("Error fetching comment author", e);
                }
                return comment;
            }));

            setComments(commentsWithAuthors);
            setCommentsLoading(false);
        }, (error) => {
            console.error("Error fetching comments:", error);
            setCommentsLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, post.id]);

    const handleLike = async () => {
        if (!user || !firestore) {
            toast({ title: "Чтобы поставить лайк, необходимо войти.", variant: "destructive" });
            return;
        }

        const postRef = doc(firestore, 'posts', post.id);
        const newLikeStatus = !isLiked;

        setIsLiked(newLikeStatus);
        setLikeCount(currentCount => newLikeStatus ? currentCount + 1 : currentCount - 1);

        try {
            if (newLikeStatus) {
                await updateDoc(postRef, {
                    likedBy: arrayUnion(user.uid)
                });
            } else {
                await updateDoc(postRef, {
                    likedBy: arrayRemove(user.uid)
                });
            }
        } catch (error: any) {
            setIsLiked(!newLikeStatus);
            setLikeCount(currentCount => newLikeStatus ? currentCount - 1 : currentCount + 1);
            toast({ title: "Не удалось обновить статус лайка.", description: error.message, variant: "destructive" });
            console.error("Error updating like status:", error);
        }
    };

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !firestore || !newComment.trim()) return;

        setIsSubmittingComment(true);
        try {
            await addDoc(collection(firestore, 'posts', post.id, 'comments'), {
                postId: post.id,
                userId: user.uid,
                text: newComment.trim(),
                createdAt: serverTimestamp(),
            });
            setNewComment('');
        } catch (error: any) {
            toast({
                title: 'Не удалось добавить комментарий',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setIsSubmittingComment(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-[90vh] w-full max-w-4xl mx-auto rounded-lg overflow-hidden">
            {/* Left Column */}
            <div className="w-full md:w-1/2 flex flex-col bg-card border-r border-border">
                {mediaUrl ? (
                    <div className="flex-1 relative bg-muted flex items-center justify-center min-h-0">
                        {mediaType === 'image' && <Image src={mediaUrl} alt={post.caption || "Изображение записи"} fill className="object-contain" />}
                        {mediaType === 'video' && <video src={mediaUrl} className="w-full h-full object-contain" controls autoPlay muted loop playsInline />}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center p-6 overflow-y-auto">
                        <p className="text-foreground/90 whitespace-pre-wrap text-center">{post.caption}</p>
                    </div>
                )}
            </div>

            {/* Right Column */}
            <div className="w-full md:w-1/2 flex flex-col bg-card">
                {/* 1. Author Header */}
                <div className="p-4 border-b">
                    {author ? (
                         <div className="flex items-start gap-3">
                            <Link href={`/profile/${author.nickname}`} className="flex-shrink-0">
                                 <Avatar className="h-10 w-10">
                                    <AvatarImage src={author.profilePictureUrl ?? undefined} alt={author.nickname} />
                                    <AvatarFallback>{author.nickname[0].toUpperCase()}</AvatarFallback>
                                 </Avatar>
                            </Link>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-foreground">
                                    <Link href={`/profile/${author.nickname}`}>{author.nickname}</Link>
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ru }) : 'только что'}
                                </p>
                                 <div className="flex items-center gap-2 pt-2">
                                    <Button variant="ghost" size="icon" onClick={handleLike}>
                                        <Heart className={cn("h-6 w-6 transition-colors", isLiked && "fill-destructive text-destructive")} />
                                    </Button>
                                    <p className="text-sm font-semibold text-muted-foreground">
                                        {likeCount} {getLikeText(likeCount)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                           <Skeleton className="h-10 w-10 rounded-full" />
                           <div className="flex-1 space-y-2">
                               <Skeleton className="h-4 w-24" />
                               <Skeleton className="h-3 w-16" />
                           </div>
                       </div>
                    )}
                </div>

                {/* 2. Scrollable Comments Area */}
                <div className="p-4 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                        {post.caption && (
                            <div className="flex items-start gap-3 pb-4 border-b mb-4">
                                {author ? (
                                    <Link href={`/profile/${author.nickname}`} className="flex-shrink-0">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={author.profilePictureUrl ?? undefined} alt={author.nickname} />
                                            <AvatarFallback>{author.nickname[0].toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                    </Link>
                                ) : <Skeleton className="h-8 w-8 rounded-full" />}
                                <div>
                                    <p className="text-sm">
                                        <Link href={`/profile/${author?.nickname}`} className="font-semibold text-foreground">{author?.nickname}</Link>
                                        <span className="ml-2 text-foreground/90 whitespace-pre-wrap">{post.caption}</span>
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        {commentsLoading && (
                            [...Array(3)].map((_, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-3 w-1/4" />
                                        <Skeleton className="h-3 w-3/4" />
                                    </div>
                                </div>
                            ))
                        )}
                        {!commentsLoading && comments.map(comment => (
                            <div key={comment.id} className="flex items-start gap-3">
                                {comment.author ? (
                                    <Link href={`/profile/${comment.author.nickname}`} className="flex-shrink-0">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={comment.author.profilePictureUrl ?? undefined} alt={comment.author.nickname} />
                                            <AvatarFallback>{comment.author.nickname[0].toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                    </Link>
                                ) : <Skeleton className="h-8 w-8 rounded-full" />}
                                <div>
                                    <p className="text-sm">
                                        <Link href={`/profile/${comment.author?.nickname}`} className="font-semibold text-foreground">{comment.author?.nickname}</Link>
                                        <span className="ml-2 text-foreground/90">{comment.text}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {comment.createdAt && new Date(comment.createdAt).toString() !== 'Invalid Date' 
                                            ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ru }) 
                                            : 'только что'}
                                    </p>
                                </div>
                            </div>
                        ))}
                         {!commentsLoading && comments.length === 0 && !post.caption && (
                            <p className="text-sm text-muted-foreground text-center py-4">Комментариев пока нет. Будьте первым!</p>
                        )}
                    </div>
                </div>

                {/* 3. Footer with Actions */}
                <div className="mt-auto p-4 border-t">
                    {userProfile && (
                        <form onSubmit={handleCommentSubmit} className="flex items-start gap-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={userProfile.profilePictureUrl ?? undefined} />
                                <AvatarFallback>{userProfile.nickname?.[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <Textarea
                                placeholder="Добавить комментарий..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleCommentSubmit(e as any);
                                    }
                                }}
                                rows={1}
                                className="flex-1 resize-none bg-muted border-none focus-visible:ring-1 focus-visible:ring-ring h-auto text-sm"
                            />
                            <Button type="submit" variant="ghost" size="sm" disabled={isSubmittingComment || !newComment.trim()}>
                                {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Отправить'}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
