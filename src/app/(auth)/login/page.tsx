'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { 
  GoogleAuthProvider, 
  signInWithRedirect, 
  getRedirectResult, 
  onAuthStateChanged 
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GoogleIcon, ZLogoIcon } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  // Начинаем с состояния загрузки, чтобы предотвратить мигание кнопки входа
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Сначала мы вызываем getRedirectResult, чтобы инициировать обработку результата перенаправления.
    // Нам не нужно использовать результат напрямую, так как onAuthStateChanged отреагирует на успешный вход.
    getRedirectResult(auth)
      .catch((error) => {
        // Здесь будут перехвачены ошибки из потока перенаправления.
        console.error("Ошибка входа при редиректе:", error);
      });

    // Затем мы устанавливаем слушатель, который будет реагировать на ЛЮБОЕ изменение состояния аутентификации.
    // Он сработает при загрузке страницы, а также после того, как getRedirectResult успешно аутентифицирует пользователя.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Если объект user существует, вход успешен. Перенаправляем в приложение.
        // Мы остаемся в состоянии "загрузки" на этой странице, потому что собираемся ее покинуть.
        router.replace('/feed');
      } else {
        // Если пользователя нет, значит, мы не вошли в систему.
        // Теперь можно безопасно показать кнопку входа.
        setLoading(false);
      }
    });

    // Очищаем слушатель при размонтировании компонента.
    return () => unsubscribe();
  }, [router]);

  const handleLogin = () => {
    setLoading(true); // Показываем экран загрузки, пока перенаправляемся на Google
    const provider = new GoogleAuthProvider();
    // Принудительно запрашиваем выбор аккаунта, чтобы избежать автоматического входа в зацикленном состоянии.
    provider.setCustomParameters({ prompt: 'select_account' }); 
    signInWithRedirect(auth, provider);
  };

  // Пока проверяется состояние аутентификации, показываем сообщение о загрузке.
  if (loading) {
    return <div className="flex h-screen items-center justify-center">Загрузка соцсети Z...</div>;
  }
  
  // Как только мы узнаем, что пользователь не вошел, показываем интерфейс входа.
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4">
                <ZLogoIcon className="w-14 h-14 text-primary" />
            </div>
          <CardTitle className="text-2xl">Добро пожаловать в Z</CardTitle>
          <CardDescription>Войдите, чтобы продолжить</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full font-semibold"
            onClick={handleLogin}
            disabled={loading}
          >
            <GoogleIcon className="mr-2 h-5 w-5" />
            Войти через Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
