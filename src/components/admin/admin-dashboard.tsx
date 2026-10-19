"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  addUserAction,
  deleteUserAction,
  saveBadgeAction,
  deleteBadgeAction,
  logoutAdmin,
  triggerManualDailyDrawAction,
  addProblemAction,
} from "@/actions/admin";
import type { User, Badge as BadgeModel } from "@/db/schema";
import {
  UserPlus,
  Trash2,
  Award,
  Plus,
  Pencil,
  LogOut,
  ArrowLeft,
  Dices,
  X,
  Code2,
} from "lucide-react";

interface AdminDashboardProps {
  initialUsers: User[];
  initialBadges: BadgeModel[];
  problemsCount: number;
  remainingProblemsCount: number;
}

export function AdminDashboard({
  initialUsers,
  initialBadges,
  problemsCount,
  remainingProblemsCount,
}: AdminDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [statusMsg, setStatusMsg] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // User form state
  const [username, setUsername] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");

  // Problem form state
  const [problemId, setProblemId] = React.useState("");
  const [problemTitle, setProblemTitle] = React.useState("");
  const [problemSlug, setProblemSlug] = React.useState("");
  const [problemDifficulty, setProblemDifficulty] = React.useState<
    "Easy" | "Medium" | "Hard"
  >("Medium");

  // Badge form state (create or edit)
  const [editingBadgeId, setEditingBadgeId] = React.useState<
    number | undefined
  >(undefined);
  const [badgeCode, setBadgeCode] = React.useState("");
  const [badgeName, setBadgeName] = React.useState("");
  const [badgeDescription, setBadgeDescription] = React.useState("");
  const [badgeIcon, setBadgeIcon] = React.useState("🏅");

  const resetBadgeForm = () => {
    setEditingBadgeId(undefined);
    setBadgeCode("");
    setBadgeName("");
    setBadgeDescription("");
    setBadgeIcon("🏅");
  };

  const handleEditBadge = (b: BadgeModel) => {
    setEditingBadgeId(b.id);
    setBadgeCode(b.code);
    setBadgeName(b.name);
    setBadgeDescription(b.description);
    setBadgeIcon(b.icon);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    startTransition(async () => {
      const res = await addUserAction({ username, displayName });
      if (res.success) {
        setUsername("");
        setDisplayName("");
        setStatusMsg({
          type: "success",
          text: `Dodano użytkownika ${displayName} (@${username}).`,
        });
        router.refresh();
      } else {
        setStatusMsg({
          type: "error",
          text: res.error || "Błąd podczas dodawania użytkownika.",
        });
      }
    });
  };

  const handleDeleteUser = (user: User) => {
    setStatusMsg(null);

    startTransition(async () => {
      const res = await deleteUserAction(user.id);
      if (res.success) {
        setStatusMsg({
          type: "success",
          text: `Usunięto kaskadowo użytkownika ${user.displayName} (@${user.username}) wraz z jego historią.`,
        });
        router.refresh();
      } else {
        setStatusMsg({
          type: "error",
          text: res.error || "Błąd podczas usuwania użytkownika.",
        });
      }
    });
  };

  const handleSaveBadge = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    startTransition(async () => {
      const res = await saveBadgeAction({
        id: editingBadgeId,
        code: badgeCode,
        name: badgeName,
        description: badgeDescription,
        icon: badgeIcon,
      });

      if (res.success) {
        setStatusMsg({
          type: "success",
          text: editingBadgeId
            ? `Zaktualizowano odznakę ${badgeName}.`
            : `Dodano nową odznakę ${badgeName}.`,
        });
        resetBadgeForm();
        router.refresh();
      } else {
        setStatusMsg({
          type: "error",
          text: res.error || "Nie udało się zapisać odznaki.",
        });
      }
    });
  };

  const handleDeleteBadge = (b: BadgeModel) => {
    setStatusMsg(null);

    startTransition(async () => {
      const res = await deleteBadgeAction(b.id);
      if (res.success) {
        if (editingBadgeId === b.id) resetBadgeForm();
        setStatusMsg({
          type: "success",
          text: `Usunięto odznakę ${b.name} [${b.code}].`,
        });
        router.refresh();
      } else {
        setStatusMsg({
          type: "error",
          text: res.error || "Nie udało się usunąć odznaki.",
        });
      }
    });
  };

  const handleManualDraw = () => {
    setStatusMsg(null);
    startTransition(async () => {
      const res = await triggerManualDailyDrawAction();
      if (res.success) {
        setStatusMsg({
          type: "success",
          text: res.message || "Wylosowano dzisiejsze zadania.",
        });
        router.refresh();
      } else {
        setStatusMsg({
          type: "error",
          text: res.error || "Nie udało się wylosować zadań.",
        });
      }
    });
  };

  const handleAddProblem = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    startTransition(async () => {
      const res = await addProblemAction({
        id: Number(problemId),
        title: problemTitle,
        titleSlug: problemSlug,
        difficulty: problemDifficulty,
      });

      if (res.success) {
        setStatusMsg({
          type: "success",
          text: `Dodano nowe zadanie #${problemId} ${problemTitle} (${problemDifficulty}) do puli!`,
        });
        setProblemId("");
        setProblemTitle("");
        setProblemSlug("");
        router.refresh();
      } else {
        setStatusMsg({
          type: "error",
          text: res.error || "Nie udało się dodać zadania.",
        });
      }
    });
  };

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAdmin();
      router.push("/admin/login");
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Powrót do Dashboardu LeetSquad
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            Panel Administratora — LeetSquad
          </h1>
          <p className="text-xs text-muted-foreground">
            Zarządzanie członkami grupy, odznakami (CRUD) oraz pulą wyzwań (pozostało wolnych:{" "}
            <strong className="font-mono text-foreground">
              {remainingProblemsCount} / {problemsCount}
            </strong>{" "}
            zadań)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualDraw}
            disabled={isPending}
            className="gap-1.5"
          >
            <Dices className="size-4" />
            Losuj zadania na dziś
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleLogout}
            disabled={isPending}
            className="gap-1.5"
          >
            <LogOut className="size-4" />
            Wyloguj
          </Button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
            statusMsg.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Section 1: Users Management */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <UserPlus className="size-4 text-primary" />
              Dodaj członka grupy
            </CardTitle>
            <CardDescription className="text-xs">
              Podaj dokładny identyfikator konta z LeetCode (username) oraz wyświetlane imię/ksywkę.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="lc-username">LeetCode Username</Label>
                <Input
                  id="lc-username"
                  placeholder="np. neal_wu"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lc-displayname">Nazwa wyświetlana (Display Name)</Label>
                <Input
                  id="lc-displayname"
                  placeholder="np. Karol"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full gap-1.5" disabled={isPending}>
                <Plus className="size-4" />
                Dodaj do grupy
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              Członkowie grupy ({initialUsers.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Usunięcie użytkownika działa kaskadowo — usuwa również przypisane do niego rozwiązania oraz zdobyte odznaki.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {initialUsers.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
                Brak dodanych użytkowników. Użyj formularza obok, aby dodać pierwszego członka!
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Display Name</TableHead>
                    <TableHead>LeetCode Handle</TableHead>
                    <TableHead className="text-center">Punkty</TableHead>
                    <TableHead className="text-center">Streak</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold">
                        {u.displayName}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        @{u.username}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {u.totalScore} pkt
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        🔥 {u.currentStreak} (max {u.longestStreak})
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="xs"
                          disabled={isPending}
                          onClick={() => handleDeleteUser(u)}
                          className="gap-1"
                        >
                          <Trash2 className="size-3" />
                          Usuń
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Badges CRUD */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4 h-fit">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Award className="size-4 text-purple-400" />
                {editingBadgeId ? "Edytuj odznakę" : "Dodaj nową odznakę"}
              </CardTitle>
              {editingBadgeId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={resetBadgeForm}
                  title="Anuluj edycję"
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
            <CardDescription className="text-xs">
              Zarządzaj tabelą <code className="font-mono">badges</code>. Możesz użyć np. kodu <code className="font-mono">SCORE_50</code> dla progu punktowego.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveBadge} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="badge-icon">Ikona (Emoji)</Label>
                  <Input
                    id="badge-icon"
                    placeholder="🏅"
                    value={badgeIcon}
                    onChange={(e) => setBadgeIcon(e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="badge-code">Kod (Unique ID)</Label>
                  <Input
                    id="badge-code"
                    placeholder="np. EARLY_BIRD"
                    value={badgeCode}
                    onChange={(e) => setBadgeCode(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="badge-name">Nazwa odznaki</Label>
                <Input
                  id="badge-name"
                  placeholder="np. Ranny Ptaszek"
                  value={badgeName}
                  onChange={(e) => setBadgeName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="badge-desc">Opis warunku zdobycia</Label>
                <Input
                  id="badge-desc"
                  placeholder="Opis wyświetlany w tooltipie..."
                  value={badgeDescription}
                  onChange={(e) => setBadgeDescription(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1 gap-1.5"
                  disabled={isPending}
                >
                  <Plus className="size-4" />
                  {editingBadgeId ? "Zapisz zmiany" : "Utwórz odznakę"}
                </Button>
                {editingBadgeId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetBadgeForm}
                  >
                    Anuluj
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              Zdefiniowane Odznaki ({initialBadges.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Pełny CRUD tabeli <code className="font-mono">badges</code> ocenianej przez Cron Job oraz synchronizację.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {initialBadges.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
                Brak odznak w bazie danych.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Ikona</TableHead>
                    <TableHead>Nazwa & Kod</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialBadges.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-xl">{b.icon}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-foreground">
                            {b.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="w-fit font-mono text-[10px]"
                          >
                            {b.code}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                        {b.description}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={isPending}
                            onClick={() => handleEditBadge(b)}
                            className="gap-1"
                          >
                            <Pencil className="size-3" />
                            Edytuj
                          </Button>
                          <Button
                            variant="destructive"
                            size="xs"
                            disabled={isPending}
                            onClick={() => handleDeleteBadge(b)}
                            className="gap-1"
                          >
                            <Trash2 className="size-3" />
                            Usuń
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Add New Problems to Pool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Code2 className="size-4 text-emerald-400" />
            Dodaj nowe zadanie do puli (gdy skończą się obecne zadania)
          </CardTitle>
          <CardDescription className="text-xs">
            Aktualnie w puli pozostało{" "}
            <strong className="font-mono text-foreground">
              {remainingProblemsCount}
            </strong>{" "}
            niewylosowanych zadań z {problemsCount}. Po wyczerpaniu wszystkich zadań możesz dopisać tutaj kolejne zadania z LeetCode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleAddProblem}
            className="grid gap-4 sm:grid-cols-12 items-end"
          >
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="prob-id">ID zadania (#)</Label>
              <Input
                id="prob-id"
                type="number"
                min={1}
                placeholder="np. 206"
                value={problemId}
                onChange={(e) => setProblemId(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-4">
              <Label htmlFor="prob-title">Tytuł zadania</Label>
              <Input
                id="prob-title"
                placeholder="np. Reverse Linked List"
                value={problemTitle}
                onChange={(e) => setProblemTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="prob-slug">Slug lub URL zadania</Label>
              <Input
                id="prob-slug"
                placeholder="np. reverse-linked-list"
                value={problemSlug}
                onChange={(e) => setProblemSlug(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="prob-diff">Trudność</Label>
              <select
                id="prob-diff"
                value={problemDifficulty}
                onChange={(e) =>
                  setProblemDifficulty(
                    e.target.value as "Easy" | "Medium" | "Hard"
                  )
                }
                className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <Button
                type="submit"
                className="w-full gap-1.5"
                disabled={isPending}
              >
                <Plus className="size-4" />
                Dodaj zadanie
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
