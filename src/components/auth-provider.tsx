'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserProfile } from '@/types';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
        } else {
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []); // Empty dependency array ensures this runs only once.

  if (loading) {
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

export const useAuth = () => useContext(AuthContext);
