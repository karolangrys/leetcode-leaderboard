"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Award } from "lucide-react";

export interface EarnedBadgeItem {
  id: number;
  userId: string;
  userDisplayName: string;
  username: string;
  badgeId: number;
  badgeCode: string;
  badgeName: string;
  badgeDescription: string;
  badgeIcon: string;
  earnedAt: string;
}

export interface BadgeCatalogItem {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
}

interface WallOfFameProps {
  earnedBadges: EarnedBadgeItem[];
  allBadges: BadgeCatalogItem[];
}

export function WallOfFame({ earnedBadges, allBadges }: WallOfFameProps) {
  // Group earned badges by user
  const byUser = new Map<
    string,
    {
      displayName: string;
      username: string;
      badges: EarnedBadgeItem[];
    }
  >();

  for (const item of earnedBadges) {
    const existing = byUser.get(item.userId) ?? {
      displayName: item.userDisplayName,
      username: item.username,
      badges: [],
    };
    existing.badges.push(item);
    byUser.set(item.userId, existing);
  }

  return (
    <TooltipProvider delay={150}>
      <Card id="wall-of-fame">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <Award className="size-5 text-purple-400" />
            <span>Wall of Fame (Odznaki)</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Najedź kursorem na odznakę, aby zobaczyć jej opis oraz datę zdobycia
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-6">
          {byUser.size === 0 ? (
            <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
              Jeszcze nikt nie zdobył odznaki. Rozwiązujcie dzienne wyzwania, aby zapełnić Wall of Fame!
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from(byUser.entries()).map(([userId, group]) => (
                <div
                  key={userId}
                  className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm text-foreground">
                        {group.displayName}
                      </span>{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        @{group.username}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {group.badges.length} odznak
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {group.badges.map((b) => (
                      <Tooltip key={b.id}>
                        <TooltipTrigger
                          render={
                            <div className="inline-flex cursor-default items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium shadow-2xs transition-colors hover:border-primary/40 hover:bg-muted/60" />
                          }
                        >
                          <span className="text-sm">{b.badgeIcon}</span>
                          <span>{b.badgeName}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs space-y-1">
                          <p className="font-semibold">
                            {b.badgeIcon} {b.badgeName}
                          </p>
                          <p className="text-xs opacity-90">
                            {b.badgeDescription}
                          </p>
                          <p className="font-mono text-[10px] opacity-70">
                            Zdobyto:{" "}
                            {new Date(b.earnedAt).toLocaleDateString("pl-PL")}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Available Badges Catalog */}
          {allBadges.length > 0 && (
            <div className="space-y-2.5 border-t border-border/50 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Katalog wszystkich odznak do zdobycia ({allBadges.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {allBadges.map((badge) => (
                  <Tooltip key={badge.id}>
                    <TooltipTrigger
                      render={
                        <div className="inline-flex cursor-default items-center gap-1.5 rounded-lg border border-dashed border-border/80 bg-muted/15 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground" />
                      }
                    >
                      <span>{badge.icon}</span>
                      <span>{badge.name}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs space-y-1">
                      <p className="font-semibold">
                        {badge.icon} {badge.name}{" "}
                        <span className="font-mono text-[10px] opacity-75">
                          [{badge.code}]
                        </span>
                      </p>
                      <p className="text-xs opacity-90">{badge.description}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
