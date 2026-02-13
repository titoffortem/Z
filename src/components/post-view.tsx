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
import { Heart, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "./ui/textarea";

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
    const [imageExpanded, setImageExpanded] = React.useState(false);

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

    return (
        <div className="flex flex-col md:flex-row h-[90vh] w-full max-w-5xl mx-auto rounded-xl overflow-hidden relative bg-background border border-border shadow-2xl">
            
            <div className="w-full md:w-1/2 h-full flex flex-col border-r border-border relative overflow-hidden">
                
                {mediaUrl && (
                    <div 
                        className={cn(
                            "cursor-pointer transition-all duration-500 ease-in-out bg-black/20 flex items-center justify-center overflow-hidden group basis-1/2 flex-shrink-0",
                            imageExpanded 
                                ? "absolute inset-0 z-[100] w-full h-full" 
                                : "relative"
                        )}
                        onClick={() => setImageExpanded(!imageExpanded)}
                    >
                        {mediaType === 'image' && (
                            <Image 
                                src={mediaUrl} 
                                alt="Контент" 
                                fill 
                                className={cn(
                                    "transition-all duration-500", 
                                    imageExpanded ? "object-contain" : "object-cover"
                                )} 
                                priority
                            />
                        )}
                        
                        <div className="absolute top-4 right-4 bg-background/60 backdrop-blur-md p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-[110]">
                            {imageExpanded ? <Minimize2 className="h-5 w-5"/> : <Maximize2 className="h-5 w-5"/>}
                        </div>
                    </div>
                )}

                <div className={cn(
                    "p-6 overflow-y-auto bg-background custom-scrollbar transition-all flex-1 min-h-0",
                    !mediaUrl && "basis-full",
                    imageExpanded && "opacity-0 pointer-events-none"
                )}>
                    <p className="text-base md:text-lg leading-relaxed text-foreground whitespace-pre-wrap">
                        {post.caption}
                    </p>
                </div>
            </div>

            <div className={cn(
                "w-full md:w-1/2 flex flex-col bg-card h-full transition-opacity duration-300",
                imageExpanded ? "opacity-0 pointer-events-none" : "opacity-100"
            )}>
                <div className="p-4 border-b border-border bg-muted/20">
                    {author && (
                        <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10 ring-1 ring-border">
                                <AvatarImage src={author.profilePictureUrl || undefined} />
                                <AvatarFallback className="bg-background text-muted-foreground">{author.nickname?.[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                                <Link href={`/profile/${author.nickname}`} className="font-bold text-foreground hover:text-primary transition-colors">
                                    @{author.nickname}
                                </Link>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                                    {post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ru }) : 'только что'}
                                </p>
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={handleLike} 
                                    className={cn(
                                        "gap-2 -ml-3 mt-1",
                                        isLiked ? "text-primary" : "text-muted-foreground"
                                    )}
                                >
                                    <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
                                    <span className="font-mono text-sm">{likeCount}</span>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
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
                    <div className="p-4 bg-muted/10 border-t border-border">
                        <form onSubmit={handleCommentSubmit} className="flex items-end gap-2 bg-background rounded-2xl p-2 border border-border">
                             <Avatar className="h-8 w-8 self-start mt-1">
                                <AvatarImage src={userProfile.profilePictureUrl ?? undefined} />
                                <AvatarFallback>{userProfile.nickname?.[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <Textarea 
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Добавить комментарий..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleCommentSubmit(e as any);
                                    }
                                }}
                                className="min-h-[40px] max-h-[120px] resize-none bg-transparent border-none focus-visible:ring-0 text-sm py-2"
                                rows={1}
                            />
                            <Button 
                                type="submit" 
                                size="sm" 
                                className="rounded-xl h-10 bg-primary text-primary-foreground"
                                disabled={!newComment.trim() || isSubmittingComment}
                            >
                                {isSubmittingComment ? <Loader2 className="animate-spin h-4 w-4"/> : 'ОК'}
                            </Button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
