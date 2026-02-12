import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ZLogoIcon } from '@/components/icons';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center justify-center text-center">
        <ZLogoIcon className="h-32 w-32 text-primary" />
        <h1 className="mt-8 text-5xl font-bold tracking-tight text-foreground md:text-6xl">
          Добро пожаловать в <span className="text-primary">Z</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Откройте для себя новый способ общения. Делитесь моментами, просматривайте популярный контент и общайтесь с ярким сообществом.
        </p>
        <div className="mt-8 flex gap-4">
          <Button asChild size="lg" className="font-semibold">
            <Link href="/feed">
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
