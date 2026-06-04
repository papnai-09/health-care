import { ReactNode } from "react";
import Link from "next/link";
import { HeartPulse, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const highlights = [
  {
    icon: Sparkles,
    title: "AI-powered triage",
    copy: "Understand symptoms quickly and know when a doctor should step in.",
  },
  {
    icon: HeartPulse,
    title: "Care from anywhere",
    copy: "Book a verified doctor consultation without travel or long queues.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    copy: "Health records are scoped to your account and easy to access.",
  },
];

export const AuthLayout = ({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) => (
  <div className="grid min-h-screen bg-background lg:grid-cols-2">
    <div className="flex flex-col p-6 md:p-10">
      <div className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-lg animate-fade-up">
          <h1 className="mb-2 text-3xl font-extrabold text-foreground md:text-4xl">{title}</h1>
          <p className="mb-8 text-muted-foreground">{subtitle}</p>
          {children}
        </div>
      </div>
      <div className="text-center text-xs text-muted-foreground">
        Copyright {new Date().getFullYear()} MediCare AI - <Link href="/" className="hover:text-foreground">Back to home</Link>
      </div>
    </div>

    <div className="relative hidden items-center justify-center overflow-hidden bg-gradient-hero p-10 lg:flex">
      <div className="grid w-full max-w-md items-stretch gap-4">
        {highlights.map((item, index) => (
          <div
            key={item.title}
            className="h-full rounded-lg border border-border bg-card/85 p-6 shadow-card backdrop-blur-xl animate-fade-up"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="mb-1 font-bold">{item.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{item.copy}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
