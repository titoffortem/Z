'use client';

import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search as SearchIcon, Loader2, UserX, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { collection, query, getDocs } from "firebase/firestore"; // убрали where и limit из импорта, если фильтруем на клиенте
import { useFirestore } from "@/firebase";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/types";

export default function SearchPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    
    const firestore = useFirestore();
    const router = useRouter();

    useEffect(() => {
        const trimmedTerm = searchTerm.trim();

        // 1. Очистка если пусто
        if (!trimmedTerm) {
            setResults([]);
            setLoading(false);
            return;
        }

        // 2. Требование: поиск только от 3 символов
        if (trimmedTerm.length < 3) {
            setResults([]); // Очищаем результаты, пока не набрано 3 символа
            setLoading(false);
            return;
        }

        // Debounce
        const delayDebounceFn = setTimeout(async () => {
            if (!firestore) return;
            
            setLoading(true);
            try {
                const usersRef = collection(firestore, 'users');
                
                // ВАЖНО: Firestore не умеет искать "содержит" (includes) и игнорировать регистр нативно.
                // Поэтому мы делаем запрос к коллекции и фильтруем в JS.
                // В продакшене для больших баз данных лучше использовать Algolia или ElasticSearch.
                
                const q = query(usersRef); // Запрашиваем документы (можно добавить limit(100) для оптимизации)
                const querySnapshot = await getDocs(q);
                
                const lowerCaseTerm = trimmedTerm.toLowerCase();

                const foundUsers = querySnapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            nickname: data.nickname || '',
                            profilePictureUrl: data.profilePictureUrl || null,
                            createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
                            followingUserIds: data.followingUserIds || [],
                            followerUserIds: data.followerUserIds || [],
                        } as UserProfile;
                    })
                    // 3. Фильтрация на клиенте: "включает" и "без регистра"
                    .filter(user => 
                        user.nickname.toLowerCase().includes(lowerCaseTerm)
                    )
                    // Ограничиваем выдачу уже после фильтрации
                    .slice(0, 10);

                setResults(foundUsers);
            } catch (error) {
                console.error("Ошибка поиска:", error);
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, firestore]);

    const handleUserClick = (nickname: string) => {
        router.push(`/profile?nickname=${nickname}`);
    };

    return (
        <div className="mx-auto max-w-2xl h-screen flex flex-col bg-background">
            <header className="border-b border-border/50 p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                <div className="relative">
                    {loading ? (
                        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                    ) : (
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    )}
                    <Input 
                        placeholder="Поиск по никнейму (мин. 3 символа)..." 
                        className="pl-10 h-11"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-2">
                {/* 1. Начальное состояние */}
                {!searchTerm && (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center p-4">
                        <SearchIcon className="h-12 w-12 mb-4 opacity-20" />
                        <p>Введите никнейм для поиска пользователей</p>
                    </div>
                )}

                {/* 2. Подсказка о длине запроса */}
                {searchTerm.trim().length > 0 && searchTerm.trim().length < 3 && (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center p-4">
                        <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
                        <p>Введите минимум 3 символа для поиска</p>
                    </div>
                )}

                {/* 3. Ничего не найдено (показываем только если введено >= 3 символов) */}
                {searchTerm.trim().length >= 3 && !loading && results.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center p-4">
                        <UserX className="h-12 w-12 mb-4 opacity-20" />
                        <p>Пользователь, содержащий <b>"{searchTerm}"</b>, не найден</p>
                    </div>
                )}

                {/* 4. Список результатов */}
                <div className="grid gap-2 mt-2">
                    {results.map((user) => (
                        <div 
                            key={user.id} 
                            onClick={() => handleUserClick(user.nickname)}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 cursor-pointer transition-all active:scale-[0.98]"
                        >
                            <Avatar className="h-12 w-12 border border-border/40">
                                <AvatarImage src={user.profilePictureUrl ?? undefined} alt={user.nickname} />
                                <AvatarFallback>{user.nickname[0]?.toUpperCase() || '?'}</AvatarFallback>
                            </Avatar>
                            
                            <div className="flex flex-col flex-1 overflow-hidden">
                                <span className="font-semibold text-foreground truncate">{user.nickname}</span>
                                <span className="text-xs text-muted-foreground">
                                    {user.followerUserIds.length} подписчиков
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}