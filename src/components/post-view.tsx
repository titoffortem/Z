'use client';

import { Post, UserProfile } from "@/types";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export function PostView({ post, author }: { post: Post, author: UserProfile | null }) {
    const mediaUrl = post.mediaUrls && post.mediaUrls[0];
    const mediaType = post.mediaTypes && post.mediaTypes[0];

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
                     <p className="text-sm text-foreground break-words">
                        {post.caption}
                    </p>
                </div>

                <div className="p-4 border-t text-center text-muted-foreground text-sm">
                    <p>Комментарии и лайки скоро появятся снова!</p>
                </div>
            </div>
        </div>
    );
}
