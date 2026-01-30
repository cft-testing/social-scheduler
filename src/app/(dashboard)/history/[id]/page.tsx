import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/utils";
import { channelTypeLabel } from "@/lib/utils";
import { CancelButton } from "./cancel-button";
import Link from "next/link";

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const post = await prisma.post.findFirst({
    where: { id, workspaceId: session!.user.workspaceId },
    include: {
      author: { select: { name: true, email: true } },
      lastEditor: { select: { name: true, email: true } },
      media: { orderBy: { order: "asc" } },
      postChannels: {
        include: { channel: true, cancelledBy: { select: { name: true, email: true } } },
      },
    },
  });

  if (!post) notFound();

  const events = await prisma.eventLog.findMany({
    where: { postId: post.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/history" className="text-sm text-blue-600 hover:underline">
          &larr; Voltar
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Detalhes da Publicação</CardTitle>
            <StatusBadge status={post.statusGlobal} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-gray-50 p-4">
            <p className="whitespace-pre-wrap text-sm">{post.text}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Autor:</span>{" "}
              {post.author.name || post.author.email}
            </div>
            <div>
              <span className="text-gray-500">Criado:</span>{" "}
              {formatDateTime(post.createdAt)}
            </div>
            {post.scheduledAtUtc && (
              <div>
                <span className="text-gray-500">Agendado para:</span>{" "}
                {formatDateTime(post.scheduledAtUtc)}
              </div>
            )}
            {post.lastEditor && (
              <div>
                <span className="text-gray-500">Último editor:</span>{" "}
                {post.lastEditor.name || post.lastEditor.email}
              </div>
            )}
          </div>

          {post.media.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-500">Media</h3>
              <div className="flex flex-wrap gap-2">
                {post.media.map((m) => (
                  <div key={m.id} className="rounded border p-2 text-xs">
                    {m.filename || m.url}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estado por Canal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {post.postChannels.map((pc) => (
              <div key={pc.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{pc.channel.name}</p>
                  <p className="text-xs text-gray-400">{channelTypeLabel(pc.channel.type)}</p>
                  {pc.lastError && (
                    <p className="mt-1 text-xs text-red-500">{pc.lastError}</p>
                  )}
                  {pc.publishedAtUtc && (
                    <p className="text-xs text-green-600">
                      Publicado: {formatDateTime(pc.publishedAtUtc)}
                    </p>
                  )}
                  {pc.cancelledBy && (
                    <p className="text-xs text-orange-600">
                      Cancelado por: {pc.cancelledBy.name || pc.cancelledBy.email}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={pc.status} />
                  {(pc.status === "SCHEDULED" || pc.status === "DRAFT") && (
                    <CancelButton postId={post.id} postChannelId={pc.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registo de Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">Sem eventos registados</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 rounded border p-2 text-sm">
                  <span
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      event.level === "ERROR"
                        ? "bg-red-500"
                        : event.level === "WARN"
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{event.action}</p>
                    <p className="text-gray-600">{event.message}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatDateTime(event.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
