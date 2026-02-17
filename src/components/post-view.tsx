'use client';

import { Post, UserProfile, Comment } from "@/types";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth-provider";
import { useFirestore } from "@/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove, collection, query, orderBy, onSnapshot, Timestamp, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Heart, Loader2, MessageCircle, X, ChevronLeft, ChevronRight, ArrowLeft, Send } from "lucide-react"; 
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

export function PostView({ post, author, isTextOnly = false }: { post: Post, author: UserProfile | null, isTextOnly?: boolean }) {
    const mediaUrls = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : [];
    const mediaTypes = post.mediaTypes && post.mediaTypes.length > 0 ? post.mediaTypes : [];

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
    const [showComments, setShowComments] = React.useState(false);

    const currentUrl = mediaUrls[currentIndex];
    const currentType = mediaTypes[currentIndex];

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
                return { id: doc.id, ...data, createdAt } as Comment;
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
                } catch (e) { console.error(e); }
                return comment;
            }));
            setComments(commentsWithAuthors);
            setCommentsLoading(false);
        });
        return () => unsubscribe();
    }, [firestore, post.id]);

    const handleLike = async () => {
        if (!user || !firestore) {
            toast({ title: "Вход не выполнен", description: "Войдите, чтобы поставить лайк", variant: "destructive" });
            return;
        }
        const postRef = doc(firestore, 'posts', post.id);
        const newLikeStatus = !isLiked;
        setIsLiked(newLikeStatus);
        setLikeCount(c => newLikeStatus ? c + 1 : c - 1);

        try {
            if (newLikeStatus) {
                await updateDoc(postRef, { likedBy: arrayUnion(user.uid) });
            } else {
                await updateDoc(postRef, { likedBy: arrayRemove(user.uid) });
            }
        } catch (error: any) {
            setIsLiked(!newLikeStatus);
            setLikeCount(c => newLikeStatus ? c - 1 : c + 1);
            toast({ title: "Ошибка", description: error.message, variant: "destructive" });
        }
    };

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !userProfile || !newComment.trim()) return;
        setIsSubmittingComment(true);
        try {
            await addDoc(collection(firestore, 'posts', post.id, 'comments'), {
                postId: post.id, userId: user.uid, text: newComment.trim(), createdAt: serverTimestamp(),
            });
            setNewComment('');
        } catch (error: any) {
            toast({ title: 'Ошибка', description: error.message, variant: "destructive" });
        } finally {
            setIsSubmittingComment(false);
        }
    };

    return (
        <div className={cn(
            "flex w-full h-full md:h-[85vh] lg:h-[90vh] bg-background overflow-hidden",
            isImageExpanded ? "flex-col" : "flex-col md:flex-row"
        )}>
            
            {/* --- ЛЕВАЯ КОЛОНКА (КОНТЕНТ) --- */}
            <div className={cn(
                "relative flex flex-col min-h-0 bg-background transition-all duration-300",
                isImageExpanded ? "w-full h-full" : "w-full h-full md:w-[60%] border-r border-border",
                showComments && "hidden md:flex" 
            )}>
                {/* Scrollable text/media area */}
                <div className="flex-1 overflow-y-auto min-h-0 relative custom-scrollbar">
                    {isTextOnly ? (
                        <div className="flex flex-col p-6 md:p-10 bg-[#32463D] min-h-full">
                            <p className="text-lg md:text-xl leading-relaxed text-white whitespace-pre-wrap break-words text-left">
                                {post.caption}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col min-h-full">
                            {currentUrl && (
                                <div className="relative w-full aspect-square md:aspect-auto md:flex-1 bg-muted/20">
                                     {currentType === 'image' ? (
                                        <Image src={currentUrl} alt="Post" fill className="object-contain" onClick={() => setIsImageExpanded(!isImageExpanded)} />
                                    ) : (
                                        <video src={currentUrl} className="w-full h-full object-contain" controls />
                                    )}
                                </div>
                            )}
                            {post.caption && (
                                <div className="p-4 bg-background">
                                    <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{post.caption}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ПЛАШКА СНИЗУ (ЛЕВАЯ) */}
                {!isImageExpanded && (
                    <div className="flex-shrink-0 sticky bottom-0 w-full p-4 bg-background/95 backdrop-blur border-t border-border flex items-center justify-between z-20">
                        {author && (
                            <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={author.profilePictureUrl || undefined} />
                                    <AvatarFallback>{author.nickname[0]}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-bold truncate max-w-[120px]">@{author.nickname}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-6">
                            <button onClick={handleLike} className={cn("flex items-center gap-2", isLiked ? "text-primary" : "text-foreground")}>
                                <Heart className={cn("h-6 w-6", isLiked && "fill-current")} />
                                <span className="text-sm font-bold">{likeCount}</span>
                            </button>
                            <button onClick={() => setShowComments(true)} className="flex items-center gap-2">
                                <MessageCircle className="h-6 w-6" />
                                <span className="text-sm font-bold">{comments.length}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* --- ПРАВАЯ КОЛОНКА (КОММЕНТАРИИ) --- */}
            <div className={cn(
                "flex flex-col min-h-0 bg-background transition-all duration-300",
                isImageExpanded ? "hidden" : "w-full h-full md:w-[40%] absolute inset-0 md:static z-30",
                !showComments && "hidden md:flex"
            )}>
                {/* Header */}
                <div className="flex-shrink-0 p-4 border-b border-border flex items-center gap-4 bg-muted/10">
                    <button onClick={() => setShowComments(false)} className="md:hidden">
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    {author && (
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={author.profilePictureUrl || undefined} />
                                <AvatarFallback>{author.nickname[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold">@{author.nickname}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">Комментарии</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto min-h-0 p-4 custom-scrollbar bg-background">
                    {commentsLoading ? (
                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>
                    ) : comments.length === 0 ? (
                        <div className="text-center p-10 text-muted-foreground text-sm">Комментариев пока нет</div>
                    ) : (
                        <div className="space-y-4">
                            {comments.map((comment) => (
                                <div key={comment.id} className="flex gap-3">
                                    <Avatar className="h-7 w-7 flex-shrink-0">
                                        <AvatarImage src={comment.author?.profilePictureUrl || undefined} />
                                        <AvatarFallback className="text-[10px]">{comment.author?.nickname?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col bg-muted/30 rounded-2xl px-3 py-2 max-w-[85%]">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-xs font-bold">@{comment.author?.nickname}</span>
                                            <span className="text-[9px] text-muted-foreground">{formatDistanceToNow(new Date(comment.createdAt), { locale: ru })}</span>
                                        </div>
                                        <p className="text-sm break-words">{comment.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ПЛАШКА СНИЗУ (ПРАВАЯ - ВВОД) */}
                <div className="flex-shrink-0 p-4 border-t border-border bg-background z-40">
                    {/* Статистика для ПК внутри правой колонки */}
                    <div className="hidden md:flex items-center gap-6 mb-4">
                        <button onClick={handleLike} className={cn("flex items-center gap-2", isLiked ? "text-primary" : "text-foreground")}>
                            <Heart className={cn("h-6 w-6", isLiked && "fill-current")} />
                            <span className="text-sm font-bold">{likeCount}</span>
                        </button>
                        <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm">
                            <MessageCircle className="h-6 w-6" />
                            <span>{comments.length}</span>
                        </div>
                    </div>

                    {userProfile && (
                        <form onSubmit={handleCommentSubmit} className="flex items-end gap-2">
                            <div className="relative flex-1">
                                <Textarea 
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Ваш комментарий..."
                                    className="min-h-[44px] max-h-[120px] rounded-2xl bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary pr-10 resize-none py-3 text-sm"
                                    rows={1}
                                />
                                <button
                                    type="submit"
                                    disabled={!newComment.trim() || isSubmittingComment}
                                    className="absolute right-2 bottom-2 p-1.5 bg-primary text-primary-foreground rounded-xl disabled:opacity-50"
                                >
                                    {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}