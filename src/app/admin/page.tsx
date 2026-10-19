import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, ensureDbInitialized } from "@/db";
import { users, badges, problems, daily_challenges } from "@/db/schema";
import { desc } from "drizzle-orm";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const isAuthenticated = await verifyAdminToken(token);

  if (!isAuthenticated) {
    redirect("/admin/login");
  }

  await ensureDbInitialized();

  const [allUsers, allBadges, allProblemsRows, usedProblemsRows] =
    await Promise.all([
      db.select().from(users).orderBy(desc(users.totalScore)),
      db.select().from(badges),
      db.select({ id: problems.id }).from(problems),
      db.select({ problemId: daily_challenges.problemId }).from(daily_challenges),
    ]);

  const usedSet = new Set(usedProblemsRows.map((r) => r.problemId));
  const problemsCount = allProblemsRows.length;
  const remainingProblemsCount = allProblemsRows.filter(
    (p) => !usedSet.has(p.id)
  ).length;

  return (
    <main className="min-h-screen bg-background">
      <AdminDashboard
        initialUsers={allUsers}
        initialBadges={allBadges}
        problemsCount={problemsCount}
        remainingProblemsCount={remainingProblemsCount}
      />
    </main>
  );
}
