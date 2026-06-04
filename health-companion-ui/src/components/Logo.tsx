import { Activity } from "lucide-react";
import Link from "next/link";

export const Logo = ({ className = "", href = "/" }: { className?: string; href?: string }) => (
  <Link href={href} className={`group flex items-center gap-2 ${className}`}>
    <div className="relative">
      <div className="relative h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-soft">
        <Activity className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
      </div>
    </div>
    <div className="flex flex-col leading-none">
      <span className="font-display text-lg font-extrabold text-foreground">MediCare</span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">AI Health</span>
    </div>
  </Link>
);
