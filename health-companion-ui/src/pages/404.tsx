import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-card">
        <p className="mb-2 text-sm font-semibold text-primary">404</p>
        <h1 className="mb-3 text-3xl font-bold">Page not found</h1>
        <p className="mb-6 text-sm leading-6 text-muted-foreground">
          The page you are looking for may have moved or is no longer available.
        </p>
        <Button asChild variant="hero">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
