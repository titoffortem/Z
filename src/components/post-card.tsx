'use client';

import { Post, UserProfile } from "@/types";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PostView } from './post-view';

export function PostCard({ post }: { post: Post }) {
    const firestore = useFirestore();
    const [author, setAuthor] = React.useState<UserProfile | null>(null);

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
    
    const mediaUrl = post.mediaUrls && post.mediaUrls[0];
    const mediaType = post.mediaTypes && post.mediaTypes[0];

    if (!post.caption && !mediaUrl) {
        return null;
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="flex flex-col h-full bg-card rounded-lg overflow-hidden border cursor-pointer transition-transform hover:scale-[1.02]">
                    <div className="relative aspect-square w-full flex items-center justify-center bg-muted overflow-hidden">
                        {mediaType === 'image' && mediaUrl ? (
                            <Image src={mediaUrl} alt={post.caption || "Изображение записи"} fill className="object-contain" />
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
                        )}
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent className="p-0 border-0 max-w-4xl bg-transparent shadow-none">
                 <PostView post={post} author={author} />
            </DialogContent>
        </Dialog>
    );
}
