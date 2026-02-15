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
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Heart, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "./ui/textarea";

export function PostView({ post, author }: { post: Post, author: UserProfile | null }) {

  const mediaUrls = post.mediaUrls || [];
  const mediaTypes = post.mediaTypes || [];

  const { user, userProfile } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [comments, setComments] = React.useState<Comment[]>([]);
  const [commentAuthors, setCommentAuthors] = React.useState<Record<string, UserProfile>>({});
  const [newComment, setNewComment] = React.useState('');
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isImageExpanded, setIsImageExpanded] = React.useState(false);

  const mediaUrl = mediaUrls[currentIndex] || null;

  /* ================= LOAD COMMENTS ================= */
  React.useEffect(() => {
    const q = query(
      collection(firestore, "posts", post.id, "comments"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: Comment[] = snapshot.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Comment, "id">)
      }));

      setComments(list);

      // Загружаем профили авторов
      const uniqueUserIds = [...new Set(list.map(c => c.userId))];

      const profiles: Record<string, UserProfile> = {};

      await Promise.all(uniqueUserIds.map(async (uid) => {
        if (!commentAuthors[uid]) {
          const snap = await getDoc(doc(firestore, "users", uid));
          if (snap.exists()) {
            profiles[uid] = snap.data() as UserProfile;
          }
        }
      }));

      if (Object.keys(profiles).length > 0) {
        setCommentAuthors(prev => ({ ...prev, ...profiles }));
      }
    });

    return () => unsubscribe();
  }, [firestore, post.id]);

  /* ================= SEND COMMENT ================= */
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    try {
      setIsSubmittingComment(true);

      await addDoc(
        collection(firestore, "posts", post.id, "comments"),
        {
          text: newComment.trim(),
          userId: user.uid,
          createdAt: serverTimestamp()
        }
      );

      setNewComment('');
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить комментарий",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[90vh] w-full max-w-5xl mx-auto rounded-xl overflow-hidden relative bg-[#40594D] border border-border shadow-2xl">

      {/* LEFT IMAGE */}
      {mediaUrl && mediaTypes[currentIndex] === 'image' && (
        <div
          className={cn(
            "relative transition-all duration-500 ease-in-out flex items-center justify-center overflow-hidden",
            isImageExpanded ? "w-full z-20" : "w-full md:w-1/2"
          )}
        >
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={() => setIsImageExpanded(!isImageExpanded)}
          >
            <Image
              src={mediaUrl}
              alt={post.caption || ""}
              fill
              className="object-contain transition-all duration-500"
              priority
              unoptimized
            />
          </div>
        </div>
      )}

      {/* RIGHT PANEL */}
      <div
        className={cn(
          "w-full md:w-1/2 flex flex-col bg-card h-full transition-all duration-500",
          isImageExpanded && "opacity-0 invisible md:w-0"
        )}
      >
        {/* HEADER */}
        {author && (
          <div className="p-4 border-b border-border flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={author.profilePictureUrl || undefined} />
              <AvatarFallback>
                {author.nickname?.[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div>
              <Link
                href={`/profile/${author.nickname}`}
                className="font-bold"
              >
                @{author.nickname}
              </Link>
              <p className="text-xs text-muted-foreground">
                {post.createdAt
                  ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ru })
                  : "только что"}
              </p>
            </div>
          </div>
        )}

        {/* TEXT + COMMENTS */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {post.caption && (
            <div className="pb-4 border-b border-border">
              <p className="whitespace-pre-wrap">{post.caption}</p>
            </div>
          )}

          {comments.map(comment => {
            const profile = commentAuthors[comment.userId];

            return (
              <div key={comment.id} className="text-sm">
                <span className="font-semibold mr-2">
                  {profile ? `@${profile.nickname}` : "загрузка..."}
                </span>
                {comment.text}
              </div>
            );
          })}

        </div>

        {/* INPUT */}
        {userProfile && (
          <div className="p-4 border-t border-border">
            <form onSubmit={handleSubmitComment} className="flex items-center gap-3">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Добавить комментарий..."
                className="min-h-[40px] resize-none text-sm"
              />

              <button
                type="submit"
                disabled={!newComment.trim() || isSubmittingComment}
                className={cn(
                  "flex items-center justify-center transition",
                  newComment.trim()
                    ? "text-primary hover:scale-110"
                    : "text-muted-foreground cursor-not-allowed"
                )}
              >
                {isSubmittingComment ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
