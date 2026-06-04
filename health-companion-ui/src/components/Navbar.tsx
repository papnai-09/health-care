import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/routes";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { to: "/#features", label: "Features" },
  { to: "/#how", label: "How it works" },
];

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useRouter();
  const { user, loading } = useAuth();

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/doctor-dashboard") || pathname.startsWith("/chatbot") || pathname.startsWith("/appointments") || pathname.startsWith("/records")) {
    return null;
  }

  const authControls = loading ? (
    <div className="h-10 w-28 rounded-lg bg-muted" />
  ) : user ? (
    <>
      <div className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground lg:flex">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-soft text-xs text-primary">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-32 truncate">{user.name}</span>
      </div>
      <Button asChild variant="hero">
        <Link href={getDashboardPath(user.role)}>Dashboard</Link>
      </Button>
    </>
  ) : (
    <>
      <Button asChild variant="ghost">
        <Link href="/login">Login</Link>
      </Button>
      <Button asChild variant="hero">
        <Link href="/register">Get Started</Link>
      </Button>
    </>
  );

  const mobileAuthControls = loading ? (
    <div className="h-10 flex-1 rounded-lg bg-muted" />
  ) : user ? (
    <Button asChild variant="hero" className="flex-1">
      <Link href={getDashboardPath(user.role)} onClick={() => setOpen(false)}>
        Dashboard
      </Link>
    </Button>
  ) : (
    <>
      <Button asChild variant="outline" className="flex-1">
        <Link href="/login" onClick={() => setOpen(false)}>
          Login
        </Link>
      </Button>
      <Button asChild variant="hero" className="flex-1">
        <Link href="/register" onClick={() => setOpen(false)}>
          Get Started
        </Link>
      </Button>
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a key={link.to} href={link.to} className="text-sm font-medium text-muted-foreground transition-smooth hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          {authControls}
        </div>
        <button className="p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background md:hidden animate-fade-up">
          <div className="container flex flex-col gap-3 py-4">
            {links.map((link) => (
              <a key={link.to} href={link.to} onClick={() => setOpen(false)} className="py-2 text-sm font-medium">
                {link.label}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              <ThemeToggle className="shrink-0" />
              {mobileAuthControls}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
