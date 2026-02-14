'use client';

import { Post, UserProfile } from "@/types";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useFirestore } from "@/firebase";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PostView } from './post-view';
import { useAuth } from "./auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function PostCard({ post }: { post: Post }) {
    const firestore = useFirestore();
    const { user } = useAuth();
    const { toast } = useToast();

    const [author, setAuthor] = React.useState<UserProfile | null>(null);
    const [isLiked, setIsLiked] = React.useState(false);
    const [likeCount, setLikeCount] = React.useState(post.likedBy?.length ?? 0);

    React.useEffect(() => {
        if (user && post.likedBy) {
            setIsLiked(post.likedBy.includes(user.uid));
        }
        setLikeCount(post.likedBy?.length ?? 0);
    }, [post, user]);

    React.useEffect(() => {
        const fetchAuthor = async () => {
            if (post.userId && firestore) {
                try {
                    const userDoc = await getDoc(doc(firestore, 'users', post.userId));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString();
                        
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
    }, [post.userId, firestore]);
    
    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();

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

    const mediaUrl = post.mediaUrls && post.mediaUrls[0];
    const mediaType = post.mediaTypes && post.mediaTypes[0];

    if (!post.caption && !mediaUrl) {
        return null;
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="flex flex-col h-full bg-card rounded-lg overflow-hidden border cursor-pointer transition-transform hover:scale-[1.02]">
                    <div className={cn("relative aspect-square w-full bg-muted overflow-hidden", mediaType !== 'image' && 'flex items-center justify-center' )}>
                        {mediaType === 'image' && mediaUrl ? (
                            <Image src={mediaUrl} alt={post.caption || "Изображение записи"} fill className="object-cover" />
                        ) : mediaType === 'video' && mediaUrl ? (
                            <video src={mediaUrl} className="w-full h-full object-cover" muted loop playsInline />
                        ) : (
                             <div className="p-4 h-full w-full overflow-hidden">
                                <p className="text-sm text-foreground break-words line-clamp-[12] text-left">
                                    {post.caption}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="p-3 flex flex-col flex-grow">
                        {mediaUrl && post.caption && (
                            <p className="font-semibold leading-snug line-clamp-2 text-foreground mb-2 flex-grow text-sm">
                                {post.caption}
                            </p>
                        )}
                        {author && (
                            <div className="flex items-center justify-between gap-3 mt-auto">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Link href={`/profile/${author.nickname}`} className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                         <Avatar className="h-8 w-8">
                                            <AvatarImage src={author.profilePictureUrl ?? undefined} alt={author.nickname} />
                                            <AvatarFallback>{author.nickname[0].toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                    </Link>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate">{author.nickname}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ru }) : 'только что'}
                                        </p>
                                    </div>
                                </div>
                                
                                <button
                                  onClick={handleLike}
                                  className={cn(
                                    "flex items-center gap-1.5 p-1.5 rounded-md transition-colors flex-shrink-0",
                                    isLiked
                                      ? "text-primary"
                                      : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  )}
                                >
                                  <Heart
                                    className={cn(
                                      "h-4 w-4",
                                      isLiked && "fill-current"
                                    )}
                                  />
                                  <span className="text-xs font-semibold">
                                    {likeCount}
                                  </span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent className="p-0 border-0 max-w-5xl bg-card">
                 <DialogTitle className="sr-only">Просмотр записи</DialogTitle>
                 <DialogDescription className="sr-only">
                    {`Подробный вид записи от пользователя ${author?.nickname || '...'} с подписью: ${post.caption || 'изображение'}`}
                 </DialogDescription>
                 <PostView post={post} author={author} />
            </DialogContent>
        </Dialog>
    );
}