'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { 
  GoogleAuthProvider, 
  signInWithRedirect, 
  getRedirectResult, 
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GoogleIcon, ZLogoIcon } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(true);

  // Effect to redirect away if user is already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/feed');
    }
  }, [user, authLoading, router]);

  // Effect to process the result from Google's redirect
  useEffect(() => {
    getRedirectResult(auth)
      .catch((err) => {
        console.error("Error on redirect result:", err);
        setError(err.message || "An error occurred during login. Please try again.");
      })
      .finally(() => {
        // We're done checking for a redirect result
        setIsProcessingRedirect(false);
      });
  }, []); // Run only once on component mount

  const handleLogin = () => {
    setError(null);
    setIsProcessingRedirect(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' }); 
    signInWithRedirect(auth, provider);
  };

  const isLoading = authLoading || isProcessingRedirect;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Проверяем статус авторизации...
      </div>
    );
  }

  // If we're done loading and a user exists, a redirect is in progress.
  // Render nothing to avoid a flash of the login page.
  if (user) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <ZLogoIcon className="w-14 h-14 text-primary" />
          </div>
          <CardTitle className="text-2xl">Добро пожаловать в Z</CardTitle>
          <CardDescription>Войдите, чтобы продолжить</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
             <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Ошибка входа</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            variant="outline"
            className="w-full font-semibold"
            onClick={handleLogin}
            disabled={isLoading}
          >
            <GoogleIcon className="mr-2 h-5 w-5" />
            Войти через Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
