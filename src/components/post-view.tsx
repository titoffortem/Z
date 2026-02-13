'use client';

import { Post, UserProfile } from "@/types";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useAuth } from "@/components/auth-provider";
import { useFirestore } from "@/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

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

    const { user } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isLiked, setIsLiked] = React.useState(false);
    const [likeCount, setLikeCount] = React.useState(post.likedBy?.length ?? 0);

    React.useEffect(() => {
        if (user && post.likedBy) {
            setIsLiked(post.likedBy.includes(user.uid));
        }
        setLikeCount(post.likedBy?.length ?? 0);
    }, [post, user]);

    const handleLike = async () => {
        if (!user || !firestore) {
            toast({ title: "Чтобы поставить лайк, необходимо войти.", variant: "destructive" });
            return;
        }

        const postRef = doc(firestore, 'posts', post.id);
        const newLikeStatus = !isLiked;

        // Optimistic update
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
        } catch (error) {
            // Revert UI on error
            setIsLiked(!newLikeStatus);
            setLikeCount(currentCount => newLikeStatus ? currentCount - 1 : currentCount + 1);
            toast({ title: "Не удалось обновить статус лайка.", description: "Попробуйте еще раз.", variant: "destructive" });
            console.error("Error updating like status:", error);
        }
    };


    return (
        <div className="flex flex-col md:flex-row max-h-[90vh] w-full max-w-4xl mx-auto rounded-lg overflow-hidden">
            {/* Media side */}
            <div className="w-full md:w-1/2 bg-muted flex items-center justify-center overflow-hidden">
                {mediaType === 'image' && mediaUrl ? (
                    <div className="relative w-full aspect-square md:h-full">
                        <Image src={mediaUrl} alt={post.caption || "Изображение записи"} fill className="object-contain" />
                    </div>
                ) : mediaType === 'video' && mediaUrl ? (
                    <video src={mediaUrl} className="w-full h-full object-contain" controls autoPlay muted loop playsInline />
                ) : (
                    <div className="flex items-center justify-center h-full p-8">
                         <p className="text-sm text-foreground break-words">{post.caption}</p>
                    </div>
                )}
            </div>

            {/* Info side */}
            <div className="w-full md:w-1/2 flex flex-col bg-card">
                <div className="p-4 border-b">
                    {author && (
                         <div className="flex items-center gap-3">
                            <Link href={`/profile/${author.nickname}`} className="flex-shrink-0">
                                 <Avatar className="h-10 w-10">
                                    <AvatarImage src={author.profilePictureUrl ?? undefined} alt={author.nickname} />
                                    <AvatarFallback>{author.nickname[0].toUpperCase()}</AvatarFallback>
                                 </Avatar>
                            </Link>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">
                                    <Link href={`/profile/${author.nickname}`}>{author.nickname}</Link>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ru }) : 'только что'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                    {mediaUrl && post.caption && (
                        <p className="text-sm text-foreground break-words">
                            {post.caption}
                        </p>
                    )}
                </div>

                <div className="p-4 border-t flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleLike}>
                        <Heart className={cn("h-6 w-6 transition-colors", isLiked && "fill-destructive text-destructive")} />
                    </Button>
                    <p className="text-sm font-semibold text-muted-foreground">
                        {likeCount} {getLikeText(likeCount)}
                    </p>
                </div>
            </div>
        </div>
    );
}
