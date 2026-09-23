import { Button } from "@/components/ui/button";

// The complete assistant remains in the root index.html served by FastAPI.
// This small entry page keeps the requested Next.js/shadcn foundation usable.
export default function Home() {
  const assistantUrl = process.env.ASSISTANT_URL || "http://127.0.0.1:8765/";
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 px-6">
      <p className="text-sm font-semibold tracking-widest text-primary">ЭЛЕКТРОКОМПЛЕКТ</p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Поможем выбрать электротехнику
      </h1>
      <p className="text-lg text-muted-foreground">
        Характеристики, наличие и аналоги. Корзина — только после вашего подтверждения.
      </p>
      <Button asChild size="lg" className="w-fit">
        <a href={assistantUrl}>Открыть помощника</a>
      </Button>
    </main>
  );
}
