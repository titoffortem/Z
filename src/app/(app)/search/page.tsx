import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";

export default function SearchPage() {
    return (
        <div className="mx-auto max-w-2xl">
            <header className="border-b border-border/50 p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Искать пользователей по никнейму..." className="pl-10"/>
                </div>
            </header>
            <div className="p-8 text-center text-muted-foreground">
                <p>Ищите друзей и других пользователей.</p>
                <p className="text-sm">Эта функция скоро появится!</p>
            </div>
        </div>
    );
}
