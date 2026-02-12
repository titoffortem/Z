'use client';

import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import type { UserProfile } from '@/types';

const formSchema = z.object({
  nickname: z.string().min(3, "Никнейм должен содержать не менее 3 символов").max(20, "Никнейм должен содержать не более 20 символов").regex(/^[a-zA-Z0-9_]+$/, "Никнейм может содержать только буквы, цифры и знаки подчеркивания"),
});

export default function CreateProfilePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nickname: '',
    },
  });

  useEffect(() => {
    if (!loading && userProfile) {
      router.push('/feed');
    }
     if (!loading && !user) {
      router.push('/login');
    }
  }, [user, userProfile, loading, router]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({
        title: 'Ошибка',
        description: 'Вы не авторизованы.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      try {
        const usersRef = collection(db, 'users');
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

        const newUserProfile = {
            id: user.uid,
            nickname: values.nickname,
            profilePictureUrl: user.photoURL,
            createdAt: serverTimestamp(),
            followingUserIds: [],
            followerUserIds: [],
        };

        await setDoc(doc(db, 'users', user.uid), newUserProfile);
        
        toast({
          title: 'Успешно!',
          description: 'Ваш профиль создан.',
        });
        
        router.push('/feed');
        router.refresh();

      } catch (error: any) {
        toast({
          title: 'Ошибка создания профиля',
          description: error.message,
          variant: 'destructive',
        });
      }
    });
  };

  if (loading || !user) {
    return <div className="flex h-screen w-full items-center justify-center">Загрузка...</div>;
  }
  
  if (userProfile) return null;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Завершите создание профиля</CardTitle>
          <CardDescription>Выберите уникальный никнейм, чтобы начать.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
