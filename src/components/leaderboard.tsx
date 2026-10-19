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
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

export interface LeaderboardEntry {
  id: string;
  username: string;
  displayName: string;
  totalScore: number;
  currentStreak: number;
  longestStreak: number;
  badgesCount: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: LeaderboardProps) {
  const sorted = [...entries].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.currentStreak !== a.currentStreak)
      return b.currentStreak - a.currentStreak;
    return a.displayName.localeCompare(b.displayName);
  });

  const getRankDisplay = (index: number) => {
    if (index === 0) return "🥇 1";
    if (index === 1) return "🥈 2";
    if (index === 2) return "🥉 3";
    return `#${index + 1}`;
  };

  return (
    <Card>
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <Trophy className="size-5 text-amber-400" />
          <span>Global Leaderboard</span>
        </CardTitle>
        <CardDescription className="text-xs">
          Ranking ogólny grupy (Easy = +1 pkt, Medium = +2 pkt, Hard = +3 pkt)
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            Brak użytkowników w rankingu.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Miejsce</TableHead>
                <TableHead>Gracz</TableHead>
                <TableHead className="text-center">Streak</TableHead>
                <TableHead className="text-center">Rekord</TableHead>
                <TableHead className="text-right">Wynik</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((entry, idx) => (
                <TableRow
                  key={entry.id}
                  className={idx === 0 ? "bg-amber-500/5" : undefined}
                >
                  <TableCell className="font-mono font-bold">
                    {getRankDisplay(idx)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">
                        {entry.displayName}
                      </span>
                      <a
                        href={`https://leetcode.com/u/${entry.username}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-muted-foreground hover:text-primary"
                      >
                        @{entry.username}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={
                        entry.currentStreak > 0
                          ? "border-orange-500/40 bg-orange-500/10 font-mono text-orange-400"
                          : "font-mono text-muted-foreground"
                      }
                    >
                      🔥 {entry.currentStreak}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">
                    {entry.longestStreak} dni
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-base font-bold text-foreground">
                      {entry.totalScore}
                    </span>{" "}
                    <span className="text-xs text-muted-foreground">pkt</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
