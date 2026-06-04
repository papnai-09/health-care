import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: { theme: string; size: string; width?: number; text?: string }) => void;
        };
      };
    };
  }
}

interface GoogleAuthButtonProps {
  onCredential: (credential: string) => void;
  disabled?: boolean;
}

export const GoogleAuthButton = ({ onCredential, disabled }: GoogleAuthButtonProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || disabled) return undefined;

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    const loadGoogle = () => setReady(true);

    if (window.google?.accounts?.id) {
      setReady(true);
      return undefined;
    }

    if (existingScript) {
      existingScript.addEventListener("load", loadGoogle);
      return () => existingScript.removeEventListener("load", loadGoogle);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", loadGoogle);
    document.head.appendChild(script);

    return () => script.removeEventListener("load", loadGoogle);
  }, [clientId, disabled]);

  useEffect(() => {
    if (!clientId || !ready || !containerRef.current || disabled || !window.google?.accounts?.id) return;

    containerRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) {
          onCredential(response.credential);
        }
      },
    });
    window.google.accounts.id.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      width: containerRef.current.offsetWidth || 320,
      text: "continue_with",
    });
  }, [clientId, disabled, onCredential, ready]);

  if (!clientId) {
    return (
      <button type="button" disabled className="h-12 w-full rounded-lg border border-border bg-muted text-sm font-semibold text-muted-foreground">
        Google login not configured
      </button>
    );
  }

  return <div ref={containerRef} className={disabled ? "pointer-events-none opacity-60" : ""} />;
};
