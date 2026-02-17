'use client';

import { App } from '@capacitor/app';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Capacitor } from '@capacitor/core';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // 1. ЛОГИКА КНОПКИ "НАЗАД" (Android)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const backListener = App.addListener('backButton', ({ canGoBack }) => {
        
        // А. ПРОВЕРКА НА ОТКРЫТЫЕ МОДАЛКИ (Radix UI)
        // Ищем любой элемент с ролью dialog или alertdialog
        const isModalOpen = document.querySelector('[role="dialog"]');
        
        if (isModalOpen) {
            // Если модалка открыта, мы не выходим из приложения.
            // Мы программно нажимаем "Escape", так как Radix UI слушает эту клавишу для закрытия.
            const escEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true,
                view: window
            });
            document.dispatchEvent(escEvent);
            return; // Прерываем выполнение, чтобы не сработал exitApp
        }

        // Б. ЛОГИКА ВЫХОДА И НАВИГАЦИИ
        // Если мы на главных страницах - сворачиваем приложение
        if (pathname === '/feed' || pathname === '/login' || pathname === '/') {
          App.exitApp();
        } else {
          // Иначе идем назад по истории
          router.back();
        }
      });

      return () => {
        backListener.then((h) => h.remove());
      };
    }
  }, [pathname, router]);

  // 2. ЗАЩИТА И РЕДИРЕКТЫ
  useEffect(() => {
    if (!loading) {
      // Если не авторизован -> только на вход
      if (!user) {
        const publicPaths = ['/', '/login', '/register'];
        if (!publicPaths.includes(pathname)) {
          router.replace('/'); 
        }
      } 
      
      // Если авторизован -> сразу в ленту, минуя "Начать"
      if (user) {
        if (pathname === '/' || pathname === '/login') {
          router.replace('/feed'); 
        }
      }
    }
  }, [user, loading, pathname, router]);

  // 3. SPLASH SCREEN
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
         {/* Логотип Z */}
         <div className="animate-pulse flex flex-col items-center">
            <h1 className="text-6xl font-bold text-primary">Z</h1>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}