import ProfilePageClient from '@/components/profile-page-client';

// This function is required for static export of dynamic routes.
// It tells Next.js not to pre-render any profile pages at build time.
// All profiles will be loaded on the client side.
export async function generateStaticParams() {
    return [];
}

export default function ProfilePage({ params }: { params: { nickname: string } }) {
    const { nickname } = params;
    return <ProfilePageClient nickname={nickname} />;
}
