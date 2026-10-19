"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CodeModal } from "@/components/code-modal";
import { syncLeaderboard } from "@/actions/sync";
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
} from "lucide-react";

export interface DailyStatusSolution {
  solutionId: number;
  userId: string;
  challengeId: number;
  solvedAt: string;
  language: string | null;
  code: string | null;
}

export interface DailyStatusUser {
  id: string;
  username: string;
  displayName: string;
  currentStreak: number;
}

export interface DailyStatusChallenge {
  challengeId: number;
  slotDifficulty: string;
  problemId: number;
  title: string;
  titleSlug: string;
}

interface DailyStatusProps {
  users: DailyStatusUser[];
  challenges: DailyStatusChallenge[];
  solutions: DailyStatusSolution[];
  initialLastSyncedAt: string | null;
  initialCooldownSeconds: number;
}

export function DailyStatus({
  users,
  challenges,
  solutions,
  initialLastSyncedAt,
  initialCooldownSeconds,
}: DailyStatusProps) {
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState<number>(
    initialCooldownSeconds
  );
  const [isPending, startTransition] = React.useTransition();
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const effectiveLastSyncedAt = lastSyncedAt ?? initialLastSyncedAt;

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSync = () => {
    if (cooldown > 0 || isPending) return;
    setFeedback(null);

    startTransition(async () => {
      try {
        const res = await syncLeaderboard();
        if (res.lastSyncedAt) {
          setLastSyncedAt(res.lastSyncedAt);
        }
        if (typeof res.cooldownRemaining === "number") {
          setCooldown(res.cooldownRemaining);
        }

        if (!res.success) {
          setFeedback({
            type: "error",
            text: res.error || "Nie udało się odświeżyć statusów.",
          });
          return;
        }

        const newCount = res.summary?.newSolutionsCount ?? 0;
        const errCount = res.summary?.errors?.length ?? 0;

        if (newCount > 0) {
          setFeedback({
            type: "success",
            text: `Zsynchronizowano! Znaleziono ${newCount} nowych rozwiązań.`,
          });
        } else if (errCount > 0) {
          setFeedback({
            type: "error",
            text: `Sprawdzono użytkowników, ale wystąpił problem z API LeetCode (${res.summary?.errors[0]}).`,
          });
        } else {
          setFeedback({
            type: "success",
            text: "Statusy są aktualne – brak nowych rozwiązań.",
          });
        }
      } catch (err) {
        setFeedback({
          type: "error",
          text:
            err instanceof Error
              ? err.message
              : "Wystąpił błąd podczas synchronizacji.",
        });
      }
    });
  };

  const order = ["Easy", "Medium", "Hard"];
  const sortedChallenges = [...challenges].sort(
    (a, b) => order.indexOf(a.slotDifficulty) - order.indexOf(b.slotDifficulty)
  );

  const solutionMap = React.useMemo(() => {
    const map = new Map<string, DailyStatusSolution>();
    for (const sol of solutions) {
      map.set(`${sol.userId}:${sol.challengeId}`, sol);
    }
    return map;
  }, [solutions]);

  const formattedLastSync = React.useMemo(() => {
    if (!effectiveLastSyncedAt) return "Nigdy";
    try {
      return new Date(effectiveLastSyncedAt).toLocaleString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "2-digit",
      });
    } catch {
      return effectiveLastSyncedAt;
    }
  }, [effectiveLastSyncedAt]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <Users className="size-5 text-primary" />
            <span>Daily Status (Tabela z Kodem)</span>
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5 text-muted-foreground" />
              Ostatnia synchronizacja:{" "}
              <strong className="font-mono text-foreground">
                {formattedLastSync}
              </strong>
            </span>
          </CardDescription>
        </div>

        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
          <Button
            onClick={handleSync}
            disabled={isPending || cooldown > 0}
            className="gap-2 font-semibold"
          >
            <RefreshCw
              className={`size-4 ${isPending ? "animate-spin" : ""}`}
            />
            {isPending ? (
              <span>Weryfikacja w API...</span>
            ) : cooldown > 0 ? (
              <span className="font-mono">Odśwież statusy ({cooldown}s)</span>
            ) : (
              <span>Odśwież statusy</span>
            )}
          </Button>
          {cooldown > 0 && (
            <span className="text-[11px] font-mono text-muted-foreground">
              Cooldown aktywny jeszcze przez {cooldown}s
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              feedback.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {users.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            Brak członków w grupie. Dodaj pierwszych użytkowników w{" "}
            <a href="/admin" className="text-primary underline">
              Panelu Admina (/admin)
            </a>
            .
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Członek grupy</TableHead>
                {sortedChallenges.map((c) => (
                  <TableHead key={c.challengeId} className="text-center">
                    <div className="flex flex-col items-center gap-0.5 py-1">
                      <Badge
                        variant="outline"
                        className={
                          c.slotDifficulty === "Easy"
                            ? "border-emerald-500/30 text-emerald-400"
                            : c.slotDifficulty === "Medium"
                              ? "border-amber-500/30 text-amber-400"
                              : "border-rose-500/30 text-rose-400"
                        }
                      >
                        {c.slotDifficulty}
                      </Badge>
                      <span className="max-w-[160px] truncate text-xs font-medium text-foreground">
                        {c.title}
                      </span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">
                        {user.displayName}
                      </span>
                      <a
                        href={`https://leetcode.com/u/${user.username}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-muted-foreground hover:text-primary"
                      >
                        @{user.username}
                      </a>
                    </div>
                  </TableCell>

                  {sortedChallenges.map((challenge) => {
                    const sol = solutionMap.get(
                      `${user.id}:${challenge.challengeId}`
                    );

                    return (
                      <TableCell
                        key={challenge.challengeId}
                        className="text-center"
                      >
                        {sol ? (
                          <div className="inline-flex flex-wrap items-center justify-center gap-2">
                            <span
                              className="text-base"
                              title={`Rozwiązano (${sol.language || "Accepted"})`}
                            >
                              ✅
                            </span>
                            <CodeModal
                              userDisplayName={user.displayName}
                              username={user.username}
                              problemTitle={challenge.title}
                              difficulty={challenge.slotDifficulty}
                              language={sol.language}
                              code={sol.code}
                              solvedAt={sol.solvedAt}
                            />
                          </div>
                        ) : (
                          <span
                            className="inline-flex items-center justify-center text-base opacity-60"
                            title="Oczekuje na rozwiązanie"
                          >
                            ⏳
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
