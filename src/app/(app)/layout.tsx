'use client';

import { useAuth } from "@/components/auth-provider";
import { MainNav } from "@/components/main-nav";
import { UnreadMessagesProvider } from "@/contexts/unread-messages-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { AppLoader } from "@/components/app-loader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return; // Do nothing while auth state is loading
    }

    if (!user) {
      // If auth is resolved and there's no user, redirect to login
      router.replace('/login');
      return;
    }

    if (user && !userProfile && pathname !== '/create-profile') {
      // If there's a user but no profile, redirect to create one
      router.replace('/create-profile');
      return;
    }
  }, [user, userProfile, loading, router, pathname]);

  // Show a loading screen while auth is resolving or if user is being redirected
  if (loading || !user || !userProfile) {
    return <AppLoader />;
  }
  
  return (
    <UnreadMessagesProvider>
      <div className="flex h-screen">
        <MainNav />
        <main className="flex-1 overflow-y-auto border-l border-border/50">{children}</main>
      </div>
    </UnreadMessagesProvider>
  );
}
