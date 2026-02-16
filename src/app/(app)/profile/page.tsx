// src/app/(app)/profile/page.tsx
import { Suspense } from 'react';
import ProfilePageClient from '@/components/profile-page-client';

export default function ProfilePage() {
    return (
        // Suspense обязателен, когда мы используем useSearchParams в статическом билде
        <Suspense fallback={<div>Loading profile...</div>}>
            <ProfilePageClient />
        </Suspense>
    );
}