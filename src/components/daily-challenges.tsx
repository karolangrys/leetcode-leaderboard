import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Code2, Sparkles, PartyPopper, Shield } from "lucide-react";
import { getDifficultyPoints } from "@/lib/utils";

export interface DailyChallengeItem {
  challengeId: number;
  date: string;
  slotDifficulty: string;
  problemId: number;
  title: string;
  titleSlug: string;
  problemDifficulty: string;
  solvedCount: number;
  totalUsers: number;
}

interface DailyChallengesProps {
  date: string;
  challenges: DailyChallengeItem[];
  remainingProblemsCount: number;
  totalProblemsCount: number;
}

const difficultyStyles: Record<
  string,
  {
    badge: string;
    border: string;
    glow: string;
    label: string;
  }
> = {
  Easy: {
    badge:
      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20",
    border: "border-emerald-500/25 hover:border-emerald-500/50",
    glow: "from-emerald-500/10 via-transparent to-transparent",
    label: "Easy (+1 pkt)",
  },
  Medium: {
    badge:
      "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20",
    border: "border-amber-500/25 hover:border-amber-500/50",
    glow: "from-amber-500/10 via-transparent to-transparent",
    label: "Medium (+2 pkt)",
  },
  Hard: {
    badge:
      "bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/20",
    border: "border-rose-500/25 hover:border-rose-500/50",
    glow: "from-rose-500/10 via-transparent to-transparent",
    label: "Hard (+3 pkt)",
  },
};

export function DailyChallenges({
  date,
  challenges,
  remainingProblemsCount,
  totalProblemsCount,
}: DailyChallengesProps) {
  const order = ["Easy", "Medium", "Hard"];
  const sorted = [...challenges].sort(
    (a, b) => order.indexOf(a.slotDifficulty) - order.indexOf(b.slotDifficulty)
  );

  const isPoolExhausted =
    totalProblemsCount > 0 && remainingProblemsCount === 0 && sorted.length === 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              Dzisiejsze Wyzwania
            </h2>
            <p className="text-xs text-muted-foreground">
              Zestaw na dzień{" "}
              <span className="font-mono font-medium text-foreground">
                {date}
              </span>{" "}
              (czas UTC)
            </p>
          </div>
        </div>

        <Badge variant="outline" className="w-fit font-mono text-xs">
          Pozostało w puli: {remainingProblemsCount} / {totalProblemsCount} zadań
        </Badge>
      </div>

      {isPoolExhausted ? (
        <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              <PartyPopper className="size-6" />
            </div>
            <div className="space-y-1 max-w-lg">
              <p className="text-base font-bold text-foreground">
                Koniec zadań! Wszystkie zadania z puli ({totalProblemsCount}) zostały już przerobione.
              </p>
              <p className="text-xs text-muted-foreground">
                Brak kolejnych wyzwań do wylosowania na dziś. Administrator musi dodać nowe zadania w Panelu Admina, aby kontynuować codzienne losowania.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/25"
            >
              <Shield className="size-3.5" />
              Przejdź do Panelu Admina i dodaj zadania
            </Link>
          </CardContent>
        </Card>
      ) : sorted.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Code2 className="mb-2 size-8 text-muted-foreground" />
            <p className="font-medium">Brak wylosowanych wyzwań na dzisiaj</p>
            <p className="text-xs text-muted-foreground mt-1">
              Uruchom skrypt{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                npm run db:seed
              </code>{" "}
              lub wylosuj zadania w Panelu Admina.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((challenge) => {
            const style =
              difficultyStyles[challenge.slotDifficulty] ??
              difficultyStyles.Easy;
            const points = getDifficultyPoints(challenge.slotDifficulty);

            return (
              <Card
                key={challenge.challengeId}
                className={`relative overflow-hidden transition-all duration-200 ${style.border} bg-gradient-to-br ${style.glow}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={`font-semibold ${style.badge}`}
                    >
                      {challenge.slotDifficulty} • +{points} pkt
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      #{challenge.problemId}
                    </span>
                  </div>
                  <CardTitle className="mt-2 line-clamp-2 text-lg leading-snug">
                    {challenge.title}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs text-muted-foreground">
                    /{challenge.titleSlug}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pb-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Rozwiązano dzisiaj:</span>
                    <span className="font-mono font-medium text-foreground">
                      {challenge.solvedCount} / {challenge.totalUsers} os.
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-2">
                  <a
                    href={`https://leetcode.com/problems/${challenge.titleSlug}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Rozwiąż na LeetCode
                    <ExternalLink className="size-3.5" />
                  </a>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
