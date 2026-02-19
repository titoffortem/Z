'use client';

import * as React from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Post, UserProfile } from '@/types';
import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';

type ChatItem = {
  id: string;
  participantIds: string[];
  updatedAt: string;
};

const toIsoDate = (value: unknown) => {
  if (value && typeof value === 'object' && 'toDate' in (value as { toDate?: unknown }) && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return new Date().toISOString();
};

export function PostForwardButton({
  post,
  className,
  iconClassName,
  stopPropagation,
  onForwarded,
}: {
  post: Post;
  className?: string;
  iconClassName?: string;
  stopPropagation?: boolean;
  onForwarded?: () => void;
}) {
  const firestore = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [sendingChatId, setSendingChatId] = React.useState<string | null>(null);
  const [chats, setChats] = React.useState<ChatItem[]>([]);
  const [profilesById, setProfilesById] = React.useState<Record<string, UserProfile>>({});

  React.useEffect(() => {
    if (!open || !firestore || !user) {
      setChats([]);
      return;
    }

    const chatsQuery = query(collection(firestore, 'chats'), where('participantIds', 'array-contains', user.uid));

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      const nextChats = snapshot.docs
        .map((chatDoc) => {
          const data = chatDoc.data();
          return {
            id: chatDoc.id,
            participantIds: data.participantIds || [],
            updatedAt: toIsoDate(data.updatedAt),
          } as ChatItem;
        })
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      setChats(nextChats);
    });

    return () => unsubscribe();
  }, [open, firestore, user]);

  React.useEffect(() => {
    if (!firestore || chats.length === 0) {
      setProfilesById({});
      return;
    }

    let cancelled = false;

    const fetchProfiles = async () => {
      const partnerIds = Array.from(
        new Set(
          chats
            .map((chat) => chat.participantIds.find((id) => id !== user?.uid))
            .filter((id): id is string => Boolean(id))
        )
      );

      const pairs = await Promise.all(
        partnerIds.map(async (id) => {
          try {
            const profileDoc = await getDoc(doc(firestore, 'users', id));
            if (!profileDoc.exists()) {
              return null;
            }

            const data = profileDoc.data();
            const profile: UserProfile = {
              id,
              nickname: data.nickname || 'Пользователь',
              profilePictureUrl: data.profilePictureUrl ?? null,
              createdAt: toIsoDate(data.createdAt),
              followingUserIds: data.followingUserIds || [],
              followerUserIds: data.followerUserIds || [],
            };

            return [id, profile] as const;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) {
        return;
      }

      setProfilesById(Object.fromEntries(pairs.filter((pair): pair is readonly [string, UserProfile] => Boolean(pair))));
    };

    void fetchProfiles();

    return () => {
      cancelled = true;
    };
  }, [firestore, chats, user?.uid]);

  const handleForwardPost = async (chatId: string) => {
    if (!firestore || !user) {
      return;
    }

    setSendingChatId(chatId);

    try {
      await addDoc(collection(firestore, 'chats', chatId, 'messages'), {
        senderId: user.uid,
        text: '',
        imageUrls: [],
        forwardedMessage: null,
        forwardedMessages: null,
        forwardedPost: {
          postId: post.id,
          caption: post.caption || '',
          mediaUrls: post.mediaUrls || [],
          mediaTypes: post.mediaTypes || [],
          authorId: post.userId,
        },
        createdAt: serverTimestamp(),
        readBy: [user.uid],
      });

      await setDoc(
        doc(firestore, 'chats', chatId),
        {
          updatedAt: serverTimestamp(),
          lastMessageText: '↪ Переслан пост',
          lastMessageSenderId: user.uid,
        },
        { merge: true }
      );

      toast({ title: 'Пост переслан' });
      setOpen(false);
      onForwarded?.();
    } catch (error: any) {
      toast({
        title: 'Не удалось переслать пост',
        description: error?.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    } finally {
      setSendingChatId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        className={className || 'p-1.5 text-muted-foreground transition-colors hover:text-primary'}
        onPointerDown={(event) => {
          if (stopPropagation) {
            event.stopPropagation();
            event.preventDefault();
          }
        }}
        onClick={(event) => {
          if (stopPropagation) {
            event.stopPropagation();
          }
          setOpen(true);
        }}
        aria-label="Переслать пост"
      >
        <Send className={iconClassName || 'h-4 w-4'} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-md"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Переслать пост</DialogTitle>
        </DialogHeader>

        {!user ? (
          <p className="text-sm text-muted-foreground">Войдите, чтобы переслать пост в личные сообщения.</p>
        ) : chats.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет доступных диалогов для пересылки.</p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {chats.map((chat) => {
              const partnerId = chat.participantIds.find((id) => id !== user.uid);
              const partner = partnerId ? profilesById[partnerId] : null;
              const isSending = sendingChatId === chat.id;

              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleForwardPost(chat.id);
                  }}
                  disabled={Boolean(sendingChatId)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/60 p-2 text-left transition hover:bg-muted/40 disabled:cursor-not-allowed"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={partner?.profilePictureUrl ?? undefined} alt={partner?.nickname || 'Чат'} />
                    <AvatarFallback>{(partner?.nickname || 'Ч')[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{partner?.nickname || 'Диалог'}</p>
                  </div>
                  {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
            }}
          >
            Закрыть
          </Button>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}
