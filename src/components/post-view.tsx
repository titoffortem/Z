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
import { PostForwardButton } from "@/components/post-forward-button";

export function PostView({ post, author }: { post: Post, author: UserProfile | null }) {
    const mediaUrls = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : [];
    const mediaTypes = post.mediaTypes && post.mediaTypes.length > 0 ? post.mediaTypes : [];

    // --- ЛОГИКА ОПРЕДЕЛЕНИЯ КОНТЕНТА ---
    const hasMedia = mediaUrls.length > 0;
    const hasText = !!post.caption && post.caption.trim().length > 0;
    
    // Условие: ТОЛЬКО текст ИЛИ ТОЛЬКО изображение (без текста)
    const isSingleContent = (hasMedia && !hasText) || (!hasMedia && hasText);
    
    // --- Логика размера шрифта для текстовых постов ---
    const textLength = post.caption ? post.caption.length : 0;
    
    const textSizeClass = React.useMemo(() => {
        if (textLength < 80) return "text-3xl md:text-5xl font-bold text-center leading-tight";
        if (textLength < 200) return "text-2xl md:text-3xl font-semibold text-center leading-snug";
        if (textLength < 500) return "text-xl md:text-2xl font-medium text-center leading-normal";
        return "text-lg md:text-xl text-left leading-relaxed";
    }, [textLength]);

    const { user, userProfile } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isLiked, setIsLiked] = React.useState(false);
    const [likeCount, setLikeCount] = React.useState(post.likedBy?.length ?? 0);
    const [comments, setComments] = React.useState<Comment[]>([]);
    const [commentsLoading, setCommentsLoading] = React.useState(true);
    const [newComment, setNewComment] = React.useState('');
    const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
    
    // UI State
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
                return { id: doc.id, ...data, likedBy: data.likedBy || [], createdAt } as Comment;
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
            if (!showComments) setShowComments(true);
        } catch (error: any) {
            toast({ title: 'Ошибка', description: error.message, variant: "destructive" });
        } finally {
            setIsSubmittingComment(false);
        }
    };


    const toggleCommentLike = async (commentId: string, isLiked: boolean) => {
        if (!firestore || !user) {
            toast({ title: 'Войдите, чтобы поставить лайк', variant: 'destructive' });
            return;
        }

        try {
            await updateDoc(doc(firestore, 'posts', post.id, 'comments', commentId), {
                likedBy: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
            });
        } catch (error: any) {
            toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
        }
    };

    const nextSlide = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % mediaUrls.length);
    };

    const prevSlide = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length);
    };

    const shouldDisplayComments = showComments || isSingleContent;

    return (
        <div className={cn(
            "flex w-full max-w-7xl mx-auto rounded-xl overflow-hidden relative bg-background border border-border shadow-2xl",
            isImageExpanded ? "flex-col h-[90vh]" : "flex-col h-[85vh] md:flex-row md:h-[90vh]"
        )}>
            
            {/* ================= ЛЕВАЯ КОЛОНКА ================= */}
            <div className={cn(
                // ИЗМЕНЕНИЕ: flex flex-col и overflow-hidden здесь, чтобы управлять дочерними элементами
                "relative bg-background transition-all duration-300 flex flex-col overflow-hidden",
                isImageExpanded 
                    ? "w-full h-full" 
                    : "w-full h-full md:w-[60%] md:h-full md:border-r border-border"
            )}>
                
                {/* 
                    СКРОЛЛИРУЕМАЯ ОБЛАСТЬ КОНТЕНТА
                    Занимает все доступное место (flex-1), скроллится внутри.
                */}
                <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col relative w-full">
                    
                    {/* МЕДИА */}
                    {hasMedia && currentUrl && (
                        <div 
                            className={cn(
                                // ИЗМЕНЕНИЕ: flex-1 flex items-center justify-center - чтобы картинка центрировалась по высоте
                                "relative w-full flex-1 bg-muted/30 group select-none flex items-center justify-center min-h-[50vh]", 
                                 currentType === 'image' && "cursor-zoom-in",
                                 isImageExpanded && "cursor-zoom-out"
                            )}
                             onClick={currentType === 'image' ? () => setIsImageExpanded(!isImageExpanded) : undefined}
                        >
                            {currentType === 'image' && (
                                <Image src={currentUrl} alt={`Slide ${currentIndex}`} fill className="object-contain" priority />
                            )}
                            {currentType === 'video' && (
                                <video key={currentUrl} src={currentUrl} className="w-full h-full object-contain" controls autoPlay loop playsInline />
                            )}

                            {mediaUrls.length > 1 && (
                                <>
                                    <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white transition-transform hover:scale-110 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] z-20">
                                        <ChevronLeft className="h-12 w-12" strokeWidth={1.5} />
                                    </button>
                                    <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white transition-transform hover:scale-110 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] z-20">
                                        <ChevronRight className="h-12 w-12" strokeWidth={1.5} />
                                    </button>
                                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20 pointer-events-none">
                                        {mediaUrls.map((_, idx) => (
                                            <div key={idx} className={cn("h-2 rounded-full transition-all shadow-sm drop-shadow-md", idx === currentIndex ? "bg-white w-6" : "bg-white/60 w-2")} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ТОЛЬКО ТЕКСТ */}
                    {!hasMedia && hasText && (
                        <div className="flex-grow flex flex-col p-6 md:p-10 bg-muted/5 min-h-[300px]">
                            {/* m-auto здесь центрирует текст по вертикали, если он маленький, и позволяет скроллить, если большой */}
                            <p className={cn(
                                "whitespace-pre-wrap break-words text-foreground m-auto max-w-full",
                                textSizeClass
                            )}>
                                {post.caption}
                            </p>
                        </div>
                    )}

                    {/* Описание под картинкой (мобилка, смешанный пост) */}
                    {hasMedia && hasText && !isImageExpanded && (
                        <div className="md:hidden p-4 pb-4">
                            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">{post.caption}</p>
                        </div>
                    )}
                </div>

                {/* 
                    НИЖНЯЯ ПАНЕЛЬ (МОБИЛЬНАЯ)
                    Находится вне скроллируемой области (flex-shrink-0), всегда прибита к низу.
                */}
                {!isImageExpanded && (
                    <div className="flex-shrink-0 md:hidden p-3 bg-background/95 backdrop-blur border-t border-border flex items-center justify-between z-10 w-full">
                        {author ? (
                            <div className="flex items-center gap-2 opacity-90">
                                <Avatar className="h-7 w-7 ring-1 ring-border/50">
                                    <AvatarImage src={author.profilePictureUrl || undefined} />
                                    <AvatarFallback>{author.nickname?.[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-bold truncate max-w-[120px]">@{author.nickname}</span>
                            </div>
                        ) : <div></div>}

                        <div className="flex items-center gap-5">
                            <PostForwardButton
                                post={post}
                                className="p-0 text-foreground hover:text-primary transition-colors"
                                iconClassName="h-6 w-6"
                            />
                            <button onClick={handleLike} className={cn("flex items-center gap-1.5", isLiked ? "text-primary" : "text-foreground")}>
                                <Heart className={cn("h-6 w-6", isLiked && "fill-current")} />
                                <span className="text-sm font-semibold">{likeCount}</span>
                            </button>
                            <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors">
                                <MessageCircle className="h-6 w-6" />
                                <span className="text-sm font-semibold">{comments.length}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ================= ПРАВАЯ КОЛОНКА ================= */}
            <div className={cn(
                "flex flex-col bg-background", 
                isImageExpanded 
                    ? "hidden" 
                    : cn(
                        "absolute inset-0 z-50 h-full w-full",
                        !showComments && "hidden", 
                        "md:static md:inset-auto md:h-full md:w-[40%] md:flex" 
                      )
            )}>
                 
                 {/* 1. HEADER */}
                 <div className="p-3 md:p-4 border-b border-border flex items-center justify-between bg-muted/20 flex-shrink-0 min-h-[60px]">
                    {/* Кнопка слева УДАЛЕНА, теперь она будет внизу блока */}
                    
                    {showComments && !isSingleContent && (
                        <button onClick={() => setShowComments(false)} className="hidden md:flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mr-auto">
                            <ArrowLeft className="h-4 w-4" />
                            Назад к описанию
                        </button>
                    )}

                    {( !showComments || (showComments && author) || isSingleContent ) && author && (
                        <div className={cn(
                            "flex items-center gap-3 min-w-0", 
                            showComments && !isSingleContent && "hidden md:hidden", 
                            // Логика скрытия автора из предыдущего шага:
                            showComments && isSingleContent && "hidden md:flex" 
                        )}> 
                            <Avatar className="h-10 w-10 ring-1 ring-border flex-shrink-0">
                                <AvatarImage src={author.profilePictureUrl || undefined} />
                                <AvatarFallback>{author.nickname?.[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <Link href={`/profile?nickname=${author.nickname}`} className="font-bold text-base text-foreground hover:text-primary">
                                    @{author.nickname}
                                </Link>
                                <span className="text-xs text-muted-foreground">
                                    {post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ru }) : "только что"}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Заголовок "Комментарии" (Мобилка) 
                        Добавлено: flex-1 text-center (чтобы занять центр) 
                        и pl-10 (отступ слева, чтобы визуально компенсировать кнопку справа и текст был ровно по центру экрана) 
                    */}
                    <span className="md:hidden font-semibold text-sm flex-1 text-center pl-10">Комментарии</span>

                    {/* ПРАВЫЙ БЛОК: Кнопки действий (ПК) */}
                    <div className="hidden md:flex items-center gap-4 ml-auto pl-4">
                        { (isSingleContent || (!showComments && !isSingleContent)) && (
                            <>
                                <PostForwardButton
                                    post={post}
                                    className="p-1 text-muted-foreground hover:text-primary transition-colors"
                                    iconClassName="h-5 w-5"
                                />
                                <button onClick={handleLike} className={cn("flex items-center gap-1.5 group", isLiked ? "text-primary" : "text-muted-foreground hover:text-primary transition-colors")}>
                                    <Heart className={cn("h-5 w-5 transition-transform group-active:scale-90", isLiked && "fill-current")} />
                                    <span className="text-sm font-semibold">{likeCount}</span>
                                </button>
                            </>
                        )}
                        
                        { (!isSingleContent && !showComments) && (
                            <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors group">
                                <MessageCircle className="h-5 w-5 transition-transform group-active:scale-90" />
                                <span className="text-sm font-semibold">{comments.length}</span>
                            </button>
                        )}
                    </div>
                    
                    {/* Кнопка закрытия (Мобилка) - ПЕРЕНЕСЕНА СЮДА (ВПРАВО) */}
                    <button onClick={() => setShowComments(false)} className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* 2. CONTENT */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative min-h-0 bg-background">
                    {!shouldDisplayComments && !isSingleContent && (
                        <div className="hidden md:block h-full">
                            {post.caption ? (
                                <p className="text-lg leading-relaxed text-foreground whitespace-pre-wrap break-words">
                                    {post.caption}
                                </p>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground italic">
                                    Без описания
                                </div>
                            )}
                        </div>
                    )}

                    {shouldDisplayComments && (
                        <div className="space-y-4 pb-4">
                            {commentsLoading ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
                            ) : comments.length === 0 ? (
                                <div className="text-center py-20 text-muted-foreground text-sm">
                                    <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                    <p>Комментариев пока нет.</p>
                                </div>
                            ) : (
                                comments.map((comment: Comment) => (
                                    <div key={comment.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                                        <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                                            <AvatarImage src={comment.author?.profilePictureUrl || undefined} />
                                            <AvatarFallback className="bg-background text-[10px]">{comment.author?.nickname?.[0]?.toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="bg-muted/40 rounded-2xl px-4 py-2.5 inline-block max-w-full">
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <p className="text-sm font-bold text-foreground">@{comment.author?.nickname || 'user'}</p>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {formatDistanceToNow(new Date(comment.createdAt), { locale: ru })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-foreground break-words leading-relaxed">{comment.text}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void toggleCommentLike(comment.id, Boolean(user && (comment.likedBy || []).includes(user.uid)))}
                                                className={cn(
                                                    "mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                                                    user && (comment.likedBy || []).includes(user.uid)
                                                        ? "text-primary"
                                                        : "text-muted-foreground hover:text-primary"
                                                )}
                                            >
                                                <Heart className={cn("h-3.5 w-3.5", user && (comment.likedBy || []).includes(user.uid) && "fill-current")} />
                                                <span>{(comment.likedBy || []).length}</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* 3. FOOTER */}
                <div className={cn(
                    "flex-shrink-0 p-3 md:p-4 border-t border-border bg-background/95 backdrop-blur-sm mt-auto pb-safe", 
                    !shouldDisplayComments && "hidden"
                )}>
                    {userProfile && (
                        <form onSubmit={handleCommentSubmit} className="flex items-end gap-2 relative">
                            <Avatar className="h-8 w-8 self-center flex-shrink-0 hidden md:block">
                                <AvatarImage src={userProfile.profilePictureUrl ?? undefined} />
                            </Avatar>
                            <div className="relative flex-1">
                                <Textarea 
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Написать..."
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommentSubmit(e as any); } }}
                                    className="min-h-[40px] max-h-[100px] resize-none bg-muted/50 border-transparent focus:border-primary pr-10 py-2.5 rounded-2xl custom-scrollbar text-sm"
                                    rows={1}
                                />
                                <button
                                    type="submit" 
                                    className="absolute right-2 bottom-2 p-1.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
                                    disabled={!newComment.trim() || isSubmittingComment}
                                >
                                    {isSubmittingComment ? <Loader2 className="animate-spin h-4 w-4"/> : <Send className="h-4 w-4" />}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}