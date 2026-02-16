'use client'; // Добавьте use client

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ZLogoIcon } from '@/components/icons';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';


export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Если мы уже вошли - мгновенно улетаем в ленту
  useEffect(() => {
    if (!loading && user) {
      router.replace('/feed');
    }
  }, [user, loading, router]);

  // Не рендерим контент "Start", если идет загрузка или юзер есть
  if (loading || user) {
    return null; 
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
       {/* Весь ваш старый JSX остался тут */}
       <div className="flex flex-col items-center justify-center text-center">
        <ZLogoIcon className="h-32 w-32 text-primary" />
        <h1 className="mt-8 text-5xl font-bold tracking-tight text-foreground md:text-6xl">
          Добро пожаловать в <span className="text-primary">Z</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Откройте для себя новый способ общения.
        </p>
        <div className="mt-8 flex gap-4">
          <Button asChild size="lg" className="font-semibold">
            <Link href="/login"> {/* Лучше сразу вести на логин, а не в feed */}
              Начать <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
       <footer className="absolute bottom-8 text-sm text-muted-foreground">
        © {new Date().getFullYear()} Z. Все права защищены.
      </footer>
    </main>
  );
}
