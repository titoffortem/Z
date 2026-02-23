import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/components/auth-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
// Импортируем нашу новую обертку
import AppShell from '@/components/app-shell';

import { PushNotificationsHandler } from '@/components/push-notifications-handler';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Z',
  description: 'Новый социальный опыт',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <FirebaseClientProvider>
          <AuthProvider>
            {/* 1. Добавляем обработчик уведомлений здесь */}
            <PushNotificationsHandler />
            {/* AppShell должен быть ВНУТРИ AuthProvider, чтобы использовать useAuth */}
            <AppShell>
              {children}
            </AppShell>
            <Toaster />
          </AuthProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}