'use client';

import { Post, UserProfile } from "@/types";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { PostView } from "./post-view";
import { Heart } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { doc, getDoc, updateDoc, increment, arrayUnion, arrayRemove } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function PostCard({ post }: { post: Post }) {
    const [open, setOpen] = React.useState(false);
    const { user } = useUser();
    const { toast } = useToast();
    const firestore = useFirestore();
    const [author, setAuthor] = React.useState<UserProfile | null>(null);
    const [isLiking, setIsLiking] = React.useState(false);

    React.useEffect(() => {
        const fetchAuthor = async () => {
            if (post.userId && firestore && user) {
                try {
                    const userDoc = await getDoc(doc(firestore, 'users', post.userId));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
                            ? data.createdAt.toDate().toISOString()
                            : new Date().toISOString();
                        
                        const userProfile: UserProfile = {
                            id: userDoc.id,
                            nickname: data.nickname,
                            profilePictureUrl: data.profilePictureUrl,
                            createdAt: createdAt,
                            followingUserIds: data.followingUserIds || [],
                            followerUserIds: data.followerUserIds || [],
                        };
                        setAuthor(userProfile);
                    }
                } catch (error) {
                    console.error("Failed to fetch post author:", error);
                }
            }
        };
        fetchAuthor();
    }, [post.userId, firestore, user]);

    const isLikedByCurrentUser = user ? post.likes?.includes(user.uid) : false;
    const [optimisticLiked, setOptimisticLiked] = React.useState(isLikedByCurrentUser);
    const [optimisticLikeCount, setOptimisticLikeCount] = React.useState(post.likesCount || 0);

    React.useEffect(() => {
        const liked = user ? post.likes?.includes(user.uid) : false;
        setOptimisticLiked(liked);
        setOptimisticLikeCount(post.likesCount || 0);
    }, [post.likes, post.likesCount, user]);

    const handleLikeClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user || !firestore) {
            toast({
                title: "Требуется аутентификация",
                description: "Вы должны быть авторизованы, чтобы ставить лайки.",
                variant: "destructive",
            });
            return;
        }
        if (isLiking) return;

        setIsLiking(true);
        const postRef = doc(firestore, 'posts', post.id);
        const wasLiked = optimisticLiked;

        setOptimisticLiked(!wasLiked);
        setOptimisticLikeCount(prevCount => wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

        try {
            if (wasLiked) {
                await updateDoc(postRef, {
                    likes: arrayRemove(user.uid),
                    likesCount: increment(-1)
                });
            } else {
                await updateDoc(postRef, {
                    likes: arrayUnion(user.uid),
                    likesCount: increment(1)
                });
            }
        } catch (error) {
            setOptimisticLiked(wasLiked);
            setOptimisticLikeCount(post.likesCount || 0);
            toast({
                title: "Ошибка",
                description: "Не удалось обновить статус лайка. Пожалуйста, попробуйте еще раз.",
                variant: "destructive",
            });
            console.error("Error updating like status:", error);
        } finally {
            setIsLiking(false);
        }
    };

    const handleCardClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a')) {
            return;
        }
        setOpen(true);
    }
    
    const mediaUrl = post.mediaUrls && post.mediaUrls[0];
    const mediaType = post.mediaTypes && post.mediaTypes[0];

    if (!post.caption && !mediaUrl) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <div onClick={handleCardClick} className="group cursor-pointer flex flex-col h-full bg-card rounded-lg overflow-hidden border">
                    <div className="relative aspect-square w-full flex items-center justify-center bg-muted overflow-hidden">
                        {mediaType === 'image' && mediaUrl ? (
                            <Image src={mediaUrl} alt={post.caption || "Изображение записи"} layout="fill" objectFit="contain" />
                        ) : mediaType === 'video' && mediaUrl ? (
                            <video src={mediaUrl} className="w-full h-full object-contain" muted loop playsInline />
                        ) : (
                             <div className="p-4 h-full w-full overflow-y-auto">
                                <p className="text-sm text-foreground break-words line-clamp-6">
                                    {post.caption}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="p-3 flex flex-col flex-grow">
                        {mediaUrl && post.caption && (
                            <p className="font-semibold leading-tight line-clamp-2 text-foreground mb-2 flex-grow">
                                {post.caption}
                            </p>
                        )}
                        {author && (
                            <div className="flex items-center gap-3 mt-auto">
                                <Link href={`/profile/${author.nickname}`} className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                                     <Avatar className="h-8 w-8">
                                        <AvatarImage src={author.profilePictureUrl ?? undefined} />
                                        <AvatarFallback>{author.nickname[0].toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                </Link>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{author.nickname}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ru }) : 'только что'}
                                    </p>
                                </div>
                                 <button onClick={handleLikeClick} disabled={isLiking} className="flex items-center gap-1.5 text-muted-foreground flex-shrink-0 p-1 rounded-full hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed">
                                    <Heart className={cn("h-5 w-5 transition-colors", optimisticLiked && "fill-red-500 text-red-500")} />
                                    <span className="text-sm font-medium">{optimisticLikeCount}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl p-0 bg-card">
                <DialogTitle className="sr-only">Запись от {author?.nickname}</DialogTitle>
                <PostView post={post} author={author} />
            </DialogContent>
        </Dialog>
    );
}
