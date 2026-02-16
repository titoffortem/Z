'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';
import type { UserProfile } from '@/types';
import type { User as FirebaseAuthUser } from 'firebase/auth';

import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';


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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
       GoogleAuth.initialize(); 
    }
  }, []);

  useEffect(() => {
    if (user && firestore) {
      setProfileLoading(true);
      const userDocRef = doc(firestore, 'users', user.uid);
      getDoc(userDocRef)
        .then((userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data();
            const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString();
            const profile: UserProfile = {
              id: userDoc.id,
              nickname: data.nickname,
              profilePictureUrl: data.profilePictureUrl,
              createdAt: createdAt,
              followingUserIds: data.followingUserIds || [],
              followerUserIds: data.followerUserIds || [],
            };
            setUserProfile(profile);
          } else {
            setUserProfile(null);
          }
        })
        .catch(console.error)
        .finally(() => {
          setProfileLoading(false);
        });
    } else if (!isAuthLoading) { // check isAuthLoading to prevent resetting profile on initial load
      setUserProfile(null);
      setProfileLoading(false);
    }
  }, [user, firestore, isAuthLoading]);

  const loading = isAuthLoading || isProfileLoading;

  // We show a global loading screen here while auth and profile are resolving.
  // Specific layouts (like AppLayout) will handle their own loading state for redirects.
  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
          <p>Загружаем приложение Z...</p>
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

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
