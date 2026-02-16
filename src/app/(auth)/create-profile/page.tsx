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
import { useFirestore } from '@/firebase';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';

const formSchema = z.object({
  nickname: z.string().min(3, "Никнейм должен содержать не менее 3 символов").max(20, "Никнейм должен содержать не более 20 символов").regex(/^[a-zA-Z0-9_]+$/, "Никнейм может содержать только буквы, цифры и знаки подчеркивания"),
});

export default function CreateProfilePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nickname: '',
    },
  });

  useEffect(() => {
    if (loading) {
      return; // Wait until authentication state is resolved
    }
    if (!user) {
      // If not logged in, redirect to login page
      router.replace('/login');
    }
    if (userProfile) {
      // If profile already exists, redirect to feed
      router.replace('/feed');
    }
  }, [user, userProfile, loading, router]);

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

        const newUserProfile = {
            id: user.uid,
            nickname: values.nickname,
            profilePictureUrl: user.photoURL,
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

  // While loading or if user is being redirected, show a loading screen.
  if (loading || !user || userProfile) {
    return <div className="flex h-screen w-full items-center justify-center">Загрузка...</div>;
  }

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
