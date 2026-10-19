"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAdmin } from "@/actions/admin";
import { Shield, ArrowLeft, Lock } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await loginAdmin(password);
      if (res.success) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(res.error || "Błąd autoryzacji.");
      }
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Powrót do Dashboardu LeetSquad
        </Link>

        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Shield className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">
                  Panel Administratora
                </CardTitle>
                <CardDescription className="text-xs">
                  Wprowadź hasło <code className="font-mono">ADMIN_PASSWORD</code>, aby zarządzać grupą LeetSquad
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="admin-password">Hasło administratora</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-2">
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={isPending}
              >
                <Lock className="size-4" />
                {isPending ? "Weryfikacja..." : "Zaloguj się"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
