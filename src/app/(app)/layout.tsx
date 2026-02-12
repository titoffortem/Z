'use client';

import { useAuth } from "@/components/auth-provider";
import { MainNav } from "@/components/main-nav";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center">Загрузка приложения...</div>;
  }
  
  return (
    <div className="flex h-screen">
      <MainNav />
      <main className="flex-1 overflow-y-auto border-l border-border/50">{children}</main>
    </div>
  );
}
