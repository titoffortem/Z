'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, MessageSquare, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useAuth } from './auth-provider';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { CreatePost } from './create-post';
import { ZLogoIcon } from './icons';

const navItems = [
  { href: '/feed', icon: Home, label: 'Лента' },
  { href: '/search', icon: Search, label: 'Поиск' },
  { href: '/messages', icon: MessageSquare, label: 'Сообщения' },
];

export function MainNav() {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  const auth = useFirebaseAuth();

  return (
    <aside className="flex h-screen w-20 flex-col items-center border-r border-border/50 bg-background py-4">
      <TooltipProvider>
        <Link href="/feed" className="mb-8">
          <ZLogoIcon className="h-10 w-10 text-primary" />
        </Link>
        <nav className="flex flex-1 flex-col items-center gap-4">
          {navItems.map((item) => (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-lg transition-colors',
                    pathname === item.href
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-6 w-6" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          <div className='mt-4'>
            <CreatePost />
          </div>
        </nav>
        <div className="flex flex-col items-center gap-4">
           {userProfile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={`/profile?nickname=${userProfile.nickname}`}>
                   <Avatar className="h-10 w-10">
                    <AvatarImage src={userProfile.profilePictureUrl ?? undefined} alt={userProfile.nickname} />
                    <AvatarFallback>{userProfile.nickname?.[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Профиль</p>
              </TooltipContent>
            </Tooltip>
           )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => auth?.signOut()}
                className="flex h-12 w-12 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-6 w-6" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Выйти</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </aside>
  );
}
