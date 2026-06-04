import { Logo } from "./Logo";

export const Footer = () => (
  <footer className="border-t border-border bg-surface">
    <div className="container grid gap-8 py-12 md:grid-cols-4">
      <div className="space-y-4 md:col-span-2">
        <Logo />
        <p className="max-w-xs text-sm leading-6 text-muted-foreground">
          Bringing quality healthcare to rural communities through AI guidance, doctor appointments, and accessible health records.
        </p>
      </div>
      <div>
        <h4 className="mb-3 text-sm font-bold">Product</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>AI Chatbot</li>
          <li>Appointments</li>
          <li>Health Records</li>
        </ul>
      </div>
      <div>
        <h4 className="mb-3 text-sm font-bold">Company</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Privacy</li>
          <li>Contact</li>
        </ul>
      </div>
    </div>
    <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
      Copyright {new Date().getFullYear()} MediCare AI. Built with care for rural health.
    </div>
  </footer>
);
