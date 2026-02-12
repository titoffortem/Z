export default function MessagesPage() {
    return (
        <div className="mx-auto max-w-2xl h-full flex flex-col">
            <header className="border-b border-border/50 p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                <h1 className="text-xl font-bold">Сообщения</h1>
            </header>
            <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                <div>
                    <p>Ваши переписки появятся здесь.</p>
                    <p className="text-sm">Эта функция скоро появится!</p>
                </div>
            </div>
        </div>
    );
}
