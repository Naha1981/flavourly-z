"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useFlavourly } from "@/lib/store";
import { X, LogIn, UserPlus, Loader2 } from "lucide-react";

export function AuthOverlay({ onAuthed }: { onAuthed: () => void }) {
  const { authOverlay, closeAuth, openAuth } = useFlavourly();
  if (!authOverlay) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto flex items-start sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <button
        onClick={closeAuth}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
      {authOverlay === "login" ? (
        <LoginForm onAuthed={onAuthed} onSwitch={() => openAuth("signup")} />
      ) : (
        <SignupForm onAuthed={onAuthed} onSwitch={() => openAuth("login")} />
      )}
    </div>
  );
}

function LoginForm({ onAuthed, onSwitch }: { onAuthed: () => void; onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { closeAuth } = useFlavourly();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      toast.error("Invalid email or password", {
        description: "Check your details and try again.",
      });
      return;
    }
    toast.success("👋 Welcome back!");
    closeAuth();
    onAuthed();
  };

  return (
    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3" style={{ background: "var(--brand)" }}>
          <LogIn className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-black">Welcome back 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">Log in to your Flavourly dashboard</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="login-email" className="text-xs font-semibold">Email</Label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.co.za"
            className="mt-1"
            required
          />
        </div>
        <div>
          <Label htmlFor="login-password" className="text-xs font-semibold">Password</Label>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1"
            required
          />
        </div>
        <Button type="submit" className="w-full bg-brand hover:bg-brand-dark text-white" size="lg" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Logging in…</> : "Log In →"}
        </Button>
      </form>

      <div className="mt-5 p-3 rounded-lg bg-brand-light text-xs text-center">
        <div className="font-semibold text-brand mb-1">🔑 Demo credentials</div>
        <div className="text-muted-foreground">
          Tenant: <code className="font-mono">mike@mikescarwash.co.za</code> / <code className="font-mono">demo1234</code>
          <br />
          Admin: <code className="font-mono">admin@flavourly.os</code> / <code className="font-mono">demo1234</code>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-5">
        Don&apos;t have an account?{" "}
        <button onClick={onSwitch} className="text-brand font-semibold hover:underline">
          Sign up
        </button>
      </p>
    </div>
  );
}

function SignupForm({ onAuthed, onSwitch }: { onAuthed: () => void; onSwitch: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [loading, setLoading] = useState(false);
  const { closeAuth } = useFlavourly();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, businessName, industry }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Signup failed");
      return;
    }
    // Auto-login after signup
    const signInRes = await signIn("credentials", { email, password, redirect: false });
    if (signInRes?.error) {
      toast.success("Account created! Please log in.");
      onSwitch();
      return;
    }
    toast.success("🎉 Account created! Welcome to Flavourly.");
    closeAuth();
    onAuthed();
  };

  return (
    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3" style={{ background: "var(--brand)" }}>
          <UserPlus className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-black">Create your account</h1>
        <p className="text-sm text-muted-foreground mt-1">Start turning walk-ins into regulars 🚀</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="signup-name" className="text-xs font-semibold">Full Name</Label>
          <Input
            id="signup-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Sipho Maseko"
            className="mt-1"
            required
          />
        </div>
        <div>
          <Label htmlFor="signup-business" className="text-xs font-semibold">Business Name</Label>
          <Input
            id="signup-business"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Sipho's Car Wash"
            className="mt-1"
            required
          />
        </div>
        <div>
          <Label htmlFor="signup-industry" className="text-xs font-semibold">Industry</Label>
          <select
            id="signup-industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            required
            className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select your industry…</option>
            <option value="restaurant">🍽️ Restaurant</option>
            <option value="cafe">☕ Café</option>
            <option value="carwash">🚗 Car Wash</option>
            <option value="salon">💅 Salon</option>
            <option value="barber">💈 Barber</option>
            <option value="retail">🛍️ Retail</option>
          </select>
        </div>
        <div>
          <Label htmlFor="signup-email" className="text-xs font-semibold">Email</Label>
          <Input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.co.za"
            className="mt-1"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="signup-password" className="text-xs font-semibold">Password</Label>
            <Input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 chars"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="signup-confirm" className="text-xs font-semibold">Confirm</Label>
            <Input
              id="signup-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat"
              className="mt-1"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full bg-brand hover:bg-brand-dark text-white" size="lg" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : "Create Account →"}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-4">
        14-day free trial. No credit card needed.
      </p>

      <p className="text-center text-sm text-muted-foreground mt-3">
        Already have an account?{" "}
        <button onClick={onSwitch} className="text-brand font-semibold hover:underline">
          Log in
        </button>
      </p>
    </div>
  );
}
