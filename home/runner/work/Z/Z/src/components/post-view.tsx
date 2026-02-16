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
import { Heart, Loader2, X, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

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

    const [isImageExpanded, setIsImageExpanded] = React.useState(false);
    const [currentIndex, setCurrentIndex] = React.useState(0);

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
        if (!user || !userProfile || !newComment.trim()) return;

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
    
    const showImageAt = (index: number) => {
        setCurrentIndex(index);
        setIsImageExpanded(true);
    };

    return (
        <>
            <div className="flex flex-col md:flex-row h-[90vh] w-full max-w-5xl mx-auto rounded-xl overflow-hidden relative bg-background border border-border shadow-2xl">
                <div className="w-full md:w-1/2 flex flex-col bg-background h-full border-r border-border overflow-y-auto min-h-0 comments-scrollbar">
                    <div className="relative bg-muted flex-shrink-0 w-full h-[60vh]">
                        {mediaUrls.length > 0 && mediaTypes.every(t => t === 'image') ? (
                            <div className="w-full h-full relative">
                                <img
                                  src={mediaUrls[currentIndex]}
                                  alt={`Post media ${currentIndex + 1}`}
                                  className="w-full h-full object-contain cursor-pointer"
                                  onClick={() => showImageAt(currentIndex)}
                                />
                                {mediaUrls.length > 1 && (
                                  <>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => (i - 1 + mediaUrls.length) % mediaUrls.length); }}
                                      className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white transition-colors text-3xl select-none"
                                      aria-label="prev"
                                    >‹</button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => (i + 1) % mediaUrls.length); }}
                                      className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white transition-colors text-3xl select-none"
                                      aria-label="next"
                                    >›</button>
                                  </>
                                )}
                            </div>
                        ) : mediaUrls.length === 1 && mediaTypes[0] === 'video' ? (
                            <div className="w-full h-full">
                                <video src={mediaUrls[0]} className="w-full h-full object-contain" controls autoPlay loop playsInline />
                            </div>
                        ) : null}
                    </div>

                    {post.caption && (
                        <div className="p-6">
                            <p className="text-base md:text-lg leading-relaxed text-foreground whitespace-pre-wrap">
                                {post.caption}
                            </p>
                        </div>
                    )}
                </div>

                <div className="w-full md:w-1/2 flex flex-col bg-card h-full">
                     <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                      {author && (
                        <>
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-10 w-10 ring-1 ring-border flex-shrink-0">
                              <AvatarImage src={author.profilePictureUrl || undefined} />
                              <AvatarFallback className="bg-background text-muted-foreground">
                                {author.nickname?.[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>

                        <div className="flex flex-col">
                          <Link
                            href={`/profile?nickname=${author.nickname}`}
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
                            onClick={handleLike}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1",
                              "bg-transparent border-none shadow-none",
                              "hover:bg-transparent active:bg-transparent",
                              "focus:outline-none focus-visible:ring-0",
                              "transition-colors",
                              isLiked
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Heart
                              className={cn(
                                "h-5 w-5 transition-colors",
                                isLiked && "fill-current"
                              )}
                            />
                            <span className="text-sm font-semibold">
                              {likeCount}
                            </span>
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-5 comments-scrollbar min-h-0">
                        {commentsLoading ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
                        ) : comments.length === 0 ? (
                             <div className="text-center py-16 text-muted-foreground text-sm">Комментариев пока нет. Будьте первым!</div>
                        ) : (
                            comments.map((comment: Comment) => (
                                <div key={comment.id} className="flex gap-3 animate-in fade-in">
                                    <Avatar className="h-7 w-7">
                                        <AvatarImage src={comment.author?.profilePictureUrl || undefined} />
                                        <AvatarFallback className="bg-background">{comment.author?.nickname?.[0]?.toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="bg-muted/50 rounded-2xl px-4 py-2 inline-block max-w-full border border-border">
                                            <p className="text-xs font-bold text-foreground mb-0.5">@{comment.author?.nickname || 'user'}</p>
                                            <p className="text-sm text-foreground break-words">{comment.text}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

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
                                    type="submit"
                                    disabled={!newComment.trim() || isSubmittingComment}
                                    className={cn(
                                        "flex items-center justify-center px-4 rounded-xl transition-colors",
                                        newComment.trim()
                                            ? "text-primary hover:text-primary/80"
                                            : "text-muted-foreground cursor-not-allowed"
                                     )}
                                >
                                     {isSubmittingComment ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                </button>
    
                            </form>
                        </div>
                    )}
                </div>
            </div>

            {/* Overlay fullscreen viewer */}
            {isImageExpanded && mediaUrls.length > 0 && (
                <Dialog open={isImageExpanded} onOpenChange={setIsImageExpanded}>
                    <DialogContent className="p-0 border-0 max-w-5xl bg-card h-[90vh] flex items-center justify-center">
                        <DialogTitle className="sr-only">
                           {`Полноэкранный просмотр: ${post.caption || `изображение ${currentIndex + 1} из ${mediaUrls.length}`}`}
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                           Галерея изображений для записи. Используйте стрелки для навигации.
                        </DialogDescription>
                        
                        <div className="relative h-full w-full">
                            <Image
                                src={mediaUrls[currentIndex]}
                                alt={`Full screen post media ${currentIndex + 1}`}
                                fill
                                className="object-contain"
                                priority
                                unoptimized
                            />
                        </div>

                        {mediaUrls.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => (i - 1 + mediaUrls.length) % mediaUrls.length); }}
                                    className="absolute left-8 top-1/2 -translate-y-1/2 z-50 text-white/70 hover:text-white transition-colors text-5xl select-none"
                                    aria-label="Previous image"
                                >
                                  ‹
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => (i + 1) % mediaUrls.length); }}
                                    className="absolute right-8 top-1/2 -translate-y-1/2 z-50 text-white/70 hover:text-white transition-colors text-5xl select-none"
                                    aria-label="Next image"
                                >
                                  ›
                                </button>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
