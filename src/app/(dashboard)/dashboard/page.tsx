import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PostStatus } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const workspaceId = session!.user.workspaceId;

  const [totalPosts, scheduled, published, failed, recentPosts, upcomingPosts] =
    await Promise.all([
      prisma.post.count({ where: { workspaceId } }),
      prisma.post.count({ where: { workspaceId, statusGlobal: PostStatus.SCHEDULED } }),
      prisma.post.count({ where: { workspaceId, statusGlobal: PostStatus.PUBLISHED } }),
      prisma.post.count({ where: { workspaceId, statusGlobal: PostStatus.FAILED } }),
      prisma.post.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: { author: { select: { name: true, email: true } } },
      }),
      prisma.post.findMany({
        where: {
          workspaceId,
          statusGlobal: PostStatus.SCHEDULED,
          scheduledAtUtc: { gte: new Date() },
        },
        orderBy: { scheduledAtUtc: "asc" },
        take: 5,
      }),
    ]);

  const stats = [
    { label: "Total de Posts", value: totalPosts, color: "text-gray-900" },
    { label: "Agendados", value: scheduled, color: "text-blue-600" },
    { label: "Publicados", value: published, color: "text-green-600" },
    { label: "Falhados", value: failed, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Próximas Publicações</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingPosts.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma publicação agendada</p>
            ) : (
              <div className="space-y-3">
                {upcomingPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/history/${post.id}`}
                    className="flex items-center justify-between rounded-md border p-3 hover:bg-gray-50"
                  >
                    <span className="text-sm truncate max-w-[200px]">{post.text}</span>
                    <span className="text-xs text-gray-500">
                      {post.scheduledAtUtc ? formatDateTime(post.scheduledAtUtc) : "—"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPosts.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma atividade recente</p>
            ) : (
              <div className="space-y-3">
                {recentPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/history/${post.id}`}
                    className="flex items-center justify-between rounded-md border p-3 hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm truncate">{post.text}</p>
                      <p className="text-xs text-gray-400">
                        {post.author.name || post.author.email}
                      </p>
                    </div>
                    <StatusBadge status={post.statusGlobal} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
