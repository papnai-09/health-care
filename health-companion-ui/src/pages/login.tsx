import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/routes";

export default function Login() {
  const router = useRouter();
  const { signIn, googleSignIn, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(getDashboardPath(user.role));
    }
  }, [authLoading, router, user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message);
    router.push(getDashboardPath(result.user?.role));
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setLoading(true);
      const result = await googleSignIn(credential);
      setLoading(false);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.push(getDashboardPath(result.user?.role));
    },
    [googleSignIn, router],
  );

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue your care journey.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <GoogleAuthButton onCredential={handleGoogleCredential} disabled={loading} />
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold uppercase text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-12 rounded-lg pl-10" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button type="button" className="text-xs font-medium text-primary hover:underline">Forgot?</button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-12 rounded-lg pl-10" />
          </div>
        </div>
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : <>Sign in <ArrowRight className="h-4 w-4" /></>}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Do not have an account? <Link href="/register" className="font-semibold text-primary hover:underline">Create one</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
