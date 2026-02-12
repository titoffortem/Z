'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserProfile } from '@/types';
import { usePathname, useRouter } from 'next/navigation';
import { Skeleton } from './ui/skeleton';

interface AuthContextType {
  user: FirebaseAuthUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseAuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          const profile: UserProfile = {
            id: data.id,
            nickname: data.nickname,
            profilePictureUrl: data.profilePictureUrl,
            createdAt: data.createdAt.toDate().toISOString(),
            followingUserIds: data.followingUserIds,
            followerUserIds: data.followerUserIds,
          };
          setUserProfile(profile);
          // Убираем редирект отсюда. Этим теперь управляют страницы и layout.
        } else {
          setUserProfile(null);
          // Если профиль не найден, перенаправляем на его создание (кроме случаев, когда мы уже там)
          if (pathname !== '/create-profile') {
            router.push('/create-profile');
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
        // Перенаправление на /login теперь обрабатывается в AppLayout.
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md p-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
