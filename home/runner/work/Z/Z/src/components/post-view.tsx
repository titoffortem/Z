'use client';

import { Post, Comment, UserProfile } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Heart, MessageCircle, Download, Link as LinkIcon, Loader2, User } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import * as React from "react";
import { useAuth } from "./auth-provider";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove, increment, collection, query, orderBy, addDoc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useCollection, useMemoFirebase } from "@/firebase";
import { Textarea } from "./ui/textarea";
import { useState } from "react";

function PostMedia({ mediaUrl, mediaType }: { mediaUrl?: string; mediaType?: string }) {
  if (mediaType === 'image' && mediaUrl) {
    return (
      <div className="relative mt-4 max-h-[70vh] w-full">
        <Image
          src={mediaUrl}
          alt="Изображение записи"
          width={1000}
          height={1000}
          className="w-full h-auto object-contain max-h-[70vh]"
          data-ai-hint="post image"
        />
      </div>
    );
  }
  if (mediaType === 'video' && mediaUrl) {
    return (
      <div className="mt-4">
        <video src={mediaUrl} controls className="w-full rounded-lg" />
      </div>
    );
  }
  return null;
}

function CommentList({ postId }: { postId: string }) {
  const commentsQuery = useMemoFirebase(() => {
    if (!db || !postId) return null;
    return query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'));
  }, [postId]);

  const { data: comments, isLoading } = useCollection<Comment>(commentsQuery);

  if (isLoading) return <div className="text-center p-4"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
  
  return (
    <div className="mt-6 space-y-6">
      {comments && comments.length > 0 ? (
        comments.map((comment) => (
          <div key={comment.id} className="flex items-start gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={comment.authorPhotoURL ?? undefined} />
              <AvatarFallback>{comment.authorNickname[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                <Link href={`/profile/${comment.authorNickname}`} className="font-semibold text-sm hover:underline">
                  {comment.authorNickname}
                </Link>
                <time dateTime={comment.createdAt} className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ru })}
                </time>
              </div>
              <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
            </div>
          </div>
        ))
      ) : (
        <p className="text-muted-foreground text-sm text-center mt-8">Комментариев пока нет. Будьте первым!</p>
      )}
    </div>
  );
}

const CommentForm = React.forwardRef<HTMLTextAreaElement, { postId: string }>(({ postId }, ref) => {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) {
      toast({ title: 'Вы должны быть авторизованы, чтобы комментировать.', variant: 'destructive' });
      return;
    }
    if (!commentText.trim()) return;

    setIsSubmitting(true);

    try {
      const postRef = doc(db, 'posts', postId);
      const commentsColRef = collection(db, 'posts', postId, 'comments');
      
      await addDoc(commentsColRef, {
        postId: postId,
        userId: user.uid,
        content: commentText.trim(),
        createdAt: serverTimestamp(),
        authorNickname: userProfile.nickname,
        authorPhotoURL: userProfile.profilePictureUrl,
      });

      await updateDoc(postRef, {
        commentCount: increment(1)
      });
      
      setCommentText('');
      toast({ title: 'Комментарий опубликован!' });
      router.refresh();
    } catch (error: any) {
      toast({
        title: 'Ошибка публикации комментария',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-3 mt-4">
      <Avatar className="h-9 w-9 mt-1">
        {userProfile ? (
          <>
            <AvatarImage src={userProfile.profilePictureUrl ?? undefined} />
            <AvatarFallback>{userProfile.nickname?.[0].toUpperCase()}</AvatarFallback>
          </>
        ) : (
          <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
        )}
      </Avatar>
      <Textarea
        ref={ref}
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        placeholder="Добавьте комментарий..."
        className="flex-1"
        rows={1}
        disabled={!user || isSubmitting}
      />
      <Button type="submit" disabled={isSubmitting || !commentText.trim() || !user}>
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Опубликовать'}
      </Button>
    </form>
  );
});
CommentForm.displayName = 'CommentForm';


export function PostView({ post: initialPost, author }: { post: Post, author: UserProfile | null }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const commentInputRef = React.useRef<HTMLTextAreaElement>(null);

    const [post, setPost] = React.useState(initialPost);
    const [isLiking, setIsLiking] = React.useState(false);
    
    React.useEffect(() => {
        setPost(initialPost);
    }, [initialPost]);

    const isLikedByCurrentUser = user ? post.likes?.includes(user.uid) : false;
    
    const handleLikeClick = async () => {
        if (!user) {
            toast({
                title: "Требуется аутентификация",
                description: "Вы должны быть авторизованы, чтобы ставить лайки.",
                variant: "destructive",
            });
            return;
        }
        if (isLiking) return;

        setIsLiking(true);
        const postRef = doc(db, 'posts', post.id);
        const likeRef = doc(db, 'posts', post.id, 'likes', user.uid);
        const wasLiked = isLikedByCurrentUser;
        
        setPost(currentPost => ({
            ...currentPost,
            likesCount: wasLiked ? currentPost.likesCount - 1 : currentPost.likesCount + 1,
            likes: wasLiked
                ? currentPost.likes?.filter(uid => uid !== user.uid)
                : [...(currentPost.likes || []), user.uid],
        }));

        try {
            if (wasLiked) {
                await deleteDoc(likeRef);
                await updateDoc(postRef, { likesCount: increment(-1) });
            } else {
                await setDoc(likeRef, { userId: user.uid, postId: post.id, createdAt: serverTimestamp() });
                await updateDoc(postRef, { likesCount: increment(1) });
            }
            router.refresh();
        } catch (error) {
            setPost(initialPost); 
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

    const postedAt = post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ru }) : 'только что';
    const mediaUrl = post.mediaUrls && post.mediaUrls[0];
    const mediaType = post.mediaTypes && post.mediaTypes[0];

    return (
        <ScrollArea className="h-[90vh]">
             {author && (
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <Avatar className="h-11 w-11">
                        <AvatarImage src={author.profilePictureUrl ?? undefined} />
                        <AvatarFallback>{author.nickname[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <Link href={`/profile/${author.nickname}`} className="font-bold hover:underline">
                                {author.nickname}
                            </Link>
                            <span className="text-sm text-muted-foreground">·</span>
                            <time dateTime={post.createdAt} className="text-sm text-muted-foreground">{postedAt}</time>
                        </div>
                        {post.caption && <p className="mt-2 whitespace-pre-wrap">{post.caption}</p>}
                    </div>
                </div>

                <div className="pl-16">
                    <PostMedia mediaUrl={mediaUrl} mediaType={mediaType} />
                    
                    <div className="mt-4 flex items-center gap-4 text-muted-foreground border-t pt-4">
                        <Button variant="ghost" size="sm" className="flex items-center gap-2" onClick={handleLikeClick} disabled={isLiking}>
                            <Heart className={cn("h-5 w-5 transition-colors", isLikedByCurrentUser && "fill-red-500 text-red-500")} />
                            <span>{post.likesCount}</span>
                        </Button>
                        <Button variant="ghost" size="sm" className="flex items-center gap-2" onClick={() => commentInputRef.current?.focus()}>
                            <MessageCircle className="h-5 w-5" />
                            <span>{post.commentCount ?? 0}</span>
                        </Button>
                    </div>
                    
                    <div className="border-t pt-6 mt-6">
                        <CommentForm postId={post.id} ref={commentInputRef} />
                        <CommentList postId={post.id} />
                    </div>
                </div>
            </div>
             )}
        </ScrollArea>
    );
}
