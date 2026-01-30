"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

interface PostItem {
  id: string;
  text: string;
  statusGlobal: string;
  scheduledAtUtc: string | null;
  createdAt: string;
  author: { name: string | null; email: string };
}

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Rascunho" },
  { value: "SCHEDULED", label: "Agendado" },
  { value: "PUBLISHING", label: "A publicar" },
  { value: "PUBLISHED", label: "Publicado" },
  { value: "FAILED", label: "Falhou" },
  { value: "CANCELLED", label: "Cancelado" },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  PUBLISHING: "bg-yellow-100 text-yellow-700",
  PUBLISHED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-orange-100 text-orange-700",
};

export default function HistoryPage() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", page.toString());
    params.set("pageSize", pageSize.toString());

    fetch(`/api/posts?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPosts(data.posts || []);
        setTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, page]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Histórico</h1>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40">
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {total} publicação(ões)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">A carregar...</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma publicação encontrada</p>
          ) : (
            <div className="space-y-2">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/history/${post.id}`}
                  className="flex items-center justify-between rounded-md border p-4 hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-medium truncate">{post.text}</p>
                    <p className="text-xs text-gray-400">
                      {post.author.name || post.author.email} &middot;{" "}
                      {new Date(post.createdAt).toLocaleDateString("pt-PT")}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[post.statusGlobal] || ""}`}>
                    {STATUS_OPTIONS.find((o) => o.value === post.statusGlobal)?.label || post.statusGlobal}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-gray-500">
                Página {page} de {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Seguinte
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
