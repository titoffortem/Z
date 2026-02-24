'use client';

import { useAuth } from '@/components/auth-provider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFirestore } from '@/firebase';
import { AppLoader } from '@/components/app-loader';
import { useToast } from '@/hooks/use-toast';
import { uploadToImageBan } from '@/lib/imageban';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfile } from 'firebase/auth';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { ChangeEvent, useEffect, useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const formSchema = z.object({
  nickname: z.string().min(3, 'Никнейм должен содержать не менее 3 символов').max(20, 'Никнейм должен содержать не более 20 символов').regex(/^[a-zA-Z0-9_]+$/, 'Никнейм может содержать только буквы, цифры и знаки подчеркивания'),
});

export default function CreateProfilePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const avatarPreviewUrl = useMemo(() => {
    if (avatarFile) {
      return URL.createObjectURL(avatarFile);
    }
    return user?.photoURL ?? undefined;
  }, [avatarFile, user?.photoURL]);

  useEffect(() => {
    return () => {
      if (avatarFile && avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarFile, avatarPreviewUrl]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nickname: '',
    },
  });

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.replace('/login');
    }
    if (userProfile) {
      router.replace('/feed');
    }
  }, [user, userProfile, loading, router]);

  const handleAvatarSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Неверный формат',
        description: 'Можно загружать только изображения.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast({
        title: 'Файл слишком большой',
        description: 'Размер аватарки должен быть до 5 МБ.',
        variant: 'destructive',
      });
      return;
    }

    setAvatarFile(file);
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!user || !firestore) {
      toast({
        title: 'Ошибка',
        description: 'Вы не авторизованы или сервис недоступен.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      try {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('nickname', '==', values.nickname));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          toast({
            title: 'Ошибка',
            description: 'Этот никнейм уже занят.',
            variant: 'destructive',
          });
          return;
        }

        let avatarUrl: string | null = user.photoURL ?? null;

        if (avatarFile) {
          avatarUrl = await uploadToImageBan(avatarFile);

          if (!avatarUrl) {
            throw new Error('Не удалось загрузить аватарку. Попробуйте ещё раз.');
          }

          await updateProfile(user, { photoURL: avatarUrl });
        }

        const newUserProfile = {
          id: user.uid,
          nickname: values.nickname,
          profilePictureUrl: avatarUrl,
          avatarHistoryUrls: avatarUrl ? [avatarUrl] : [],
          createdAt: serverTimestamp(),
          followingUserIds: [],
          followerUserIds: [],
        };

        await setDoc(doc(firestore, 'users', user.uid), newUserProfile);

        toast({
          title: 'Успешно!',
          description: 'Ваш профиль создан.',
        });

        window.location.href = '/feed';
      } catch (error: any) {
        toast({
          title: 'Ошибка создания профиля',
          description: error.message,
          variant: 'destructive',
        });
      }
    });
  };

  if (loading || !user || userProfile) {
    return <AppLoader />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Завершите создание профиля</CardTitle>
          <CardDescription>Выберите уникальный никнейм и аватар.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border border-border">
                  <AvatarImage src={avatarPreviewUrl} alt="Предпросмотр аватарки" />
                  <AvatarFallback>{form.watch('nickname')?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="avatar-upload">Аватарка</label>
                  <Input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarSelect} />
                  <p className="text-xs text-muted-foreground">PNG/JPG/WebP до 5 МБ. Файл кэшируется в браузере после загрузки.</p>
                </div>
              </div>

              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Никнейм</FormLabel>
                    <FormControl>
                      <Input placeholder="ваш_крутой_никнейм" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Сохранение...' : 'Сохранить и продолжить'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
