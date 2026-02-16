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
import { Textarea } from "@/components/ui/textarea";

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
        <div
          className={cn(
            // 1. КОНТЕЙНЕР: Фиксированная высота 85vh (чуть меньше экрана, чтобы было видно крестик или фон)
            // flex-col для мобилок, flex-row для ПК
            "flex w-full max-w-5xl mx-auto rounded-xl overflow-hidden relative bg-background border border-border shadow-2xl",
            isImageExpanded ? "flex-col h-[85vh]" : "flex-col h-[85vh] md:flex-row md:h-[90vh]"
          )}
        >
            {/* --- ЛЕВАЯ КОЛОНКА (Медиа + Текст) --- */}
            <div
              className={cn(
                "relative bg-background transition-all duration-300",
                "overflow-y-auto scrollbar-hide", // Скролл для текста поста
                isImageExpanded
                  ? "w-full h-full" // Если картинка развернута - на весь экран
                  : "w-full h-[70%] md:w-1/2 md:h-full border-b md:border-b-0 md:border-r border-border"
                  // h-[40%] - на мобилках занимает верхние 40% высоты
              )}
            >
                {mediaUrl && (
                    <div 
                        className={cn(
                            "relative w-full bg-muted flex-shrink-0", 
                             mediaType === 'image' && "cursor-pointer",
                             // Картинка не должна быть слишком высокой на мобилках, чтобы осталось место тексту
                             isImageExpanded ? "min-h-full" : "min-h-[250px] md:aspect-square"
                        )}
                         onClick={mediaType === 'image' ? () => setIsImageExpanded(!isImageExpanded) : undefined}
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

                {post.caption && !isImageExpanded && (
                    <div className="p-4 md:p-6">
                        <p className="text-sm md:text-lg leading-relaxed text-foreground whitespace-pre-wrap break-words">
                            {post.caption}
                        </p>
                    </div>
                )}
            </div>

            {/* --- ПРАВАЯ КОЛОНКА (Комментарии) --- */}
            <div className={cn(
                "flex flex-col bg-card w-full",
                // h-[60%] - на мобилках занимает оставшиеся 60%
                // min-h-0 - ВАЖНО для скролла во flex-контейнерах
                isImageExpanded ? "hidden" : "h-[30%] md:h-full md:w-1/2 min-h-0"
            )}>
                 {/* Шапка комментариев (автор, лайк) - фиксированная */}
                 <div className="p-3 md:p-4 border-b border-border flex items-center justify-between bg-muted/20 flex-shrink-0">
                  {author && (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8 md:h-10 md:w-10 ring-1 ring-border flex-shrink-0">
                          <AvatarImage src={author.profilePictureUrl || undefined} />
                          <AvatarFallback className="bg-background text-muted-foreground">
                            {author.nickname?.[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex flex-col">
                          <Link
                            href={`/profile?nickname=${author.nickname}`}
                            className="font-bold text-sm md:text-base text-foreground hover:text-primary transition-colors"
                          >
                            @{author.nickname}
                          </Link>

                          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                            {post.createdAt
                              ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ru })
                              : "только что"}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleLike}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1",
                          "bg-transparent border-none shadow-none",
                          isLiked ? "text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
                        <span className="text-sm font-semibold">{likeCount}</span>
                      </button>
                    </>
                  )}
                </div>

                {/* СПИСОК КОММЕНТАРИЕВ - Скроллится здесь */}
                {/* flex-1 заставляет этот блок занять всё доступное место между шапкой и формой ввода */}
                <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4 comments-scrollbar">
                    {commentsLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
                    ) : comments.length === 0 ? (
                         <div className="text-center py-10 text-muted-foreground text-xs md:text-sm">Комментариев пока нет.</div>
                    ) : (
                        comments.map((comment: Comment) => (
                            <div key={comment.id} className="flex gap-2 md:gap-3 animate-in fade-in">
                                <Avatar className="h-6 w-6 md:h-7 md:w-7 flex-shrink-0">
                                    <AvatarImage src={comment.author?.profilePictureUrl || undefined} />
                                    <AvatarFallback className="bg-background text-[10px]">{comment.author?.nickname?.[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="bg-muted/50 rounded-2xl px-3 py-2 inline-block max-w-full border border-border">
                                        <p className="text-xs font-bold text-foreground mb-0.5">@{comment.author?.nickname || 'user'}</p>
                                        <p className="text-xs md:text-sm text-foreground break-words">{comment.text}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Форма ввода - фиксированная снизу */}
                {userProfile && (
                    <div className="p-3 md:p-4 bg-muted/10 border-t border-border flex-shrink-0">
                        <form onSubmit={handleCommentSubmit} className="flex items-end gap-2 bg-background rounded-2xl p-2 border border-border">
                             <Avatar className="h-7 w-7 md:h-8 md:w-8 self-start mt-1 flex-shrink-0">
                                <AvatarImage src={userProfile.profilePictureUrl ?? undefined} />
                                <AvatarFallback>{userProfile.nickname?.[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <Textarea 
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Написать..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleCommentSubmit(e as any);
                                    }
                                }}
                                className="min-h-[36px] max-h-[80px] resize-none bg-transparent border-none focus-visible:ring-0 text-sm py-2"
                                rows={1}
                            />
                            <button
                                type="submit" 
                                className="rounded-xl h-9 w-9 md:h-10 md:w-auto bg-primary text-primary-foreground px-0 md:px-4 text-sm font-medium disabled:opacity-50 flex items-center justify-center flex-shrink-0"
                                disabled={!newComment.trim() || isSubmittingComment}
                            >
                                {isSubmittingComment ? <Loader2 className="animate-spin h-4 w-4"/> : <span className="hidden md:inline">ОК</span>}
                                {!isSubmittingComment && <span className="md:hidden">➜</span>}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
