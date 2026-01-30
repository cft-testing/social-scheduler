"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Channel {
  id: string;
  name: string;
  type: string;
  provider: string;
  connected: boolean;
}

export default function ComposerPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mediaIds, setMediaIds] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((data) => setChannels(data.channels || []))
      .catch(() => {});
  }, []);

  function toggleChannel(id: string) {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    const newMediaIds: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          newMediaIds.push(data.id);
        }
      } catch {
        // ignore individual upload errors
      }
    }

    setMediaFiles((prev) => [...prev, ...files]);
    setMediaIds((prev) => [...prev, ...newMediaIds]);
    setUploading(false);
  }

  async function handleSubmit(asDraft: boolean) {
    setError("");
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        text,
        channelIds: selectedChannels,
        mediaIds,
      };
      if (!asDraft && scheduledAt) {
        body.scheduledAtUtc = new Date(scheduledAt).toISOString();
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao criar publicação");
        setSubmitting(false);
        return;
      }

      const post = await res.json();

      if (!asDraft && scheduledAt) {
        await fetch(`/api/posts/${post.id}/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduledAtUtc: new Date(scheduledAt).toISOString() }),
        });
      }

      router.push("/history");
      router.refresh();
    } catch {
      setError("Erro de rede");
    }
    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Compositor</h1>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nova Publicação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Texto</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escreva o conteúdo da publicação..."
              rows={6}
            />
            <p className="text-xs text-gray-400">{text.length} caracteres</p>
          </div>

          <div className="space-y-2">
            <Label>Canais</Label>
            {channels.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum canal conectado</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {channels
                  .filter((c) => c.connected)
                  .map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => toggleChannel(channel.id)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        selectedChannels.includes(channel.id)
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {channel.name}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Imagens</Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={handleMediaUpload}
              disabled={uploading}
            />
            {mediaFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {mediaFiles.map((f, i) => (
                  <span key={i} className="rounded bg-gray-100 px-2 py-1 text-xs">
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Agendar para</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => handleSubmit(true)}
              disabled={submitting || !text || selectedChannels.length === 0}
            >
              Guardar Rascunho
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={submitting || !text || selectedChannels.length === 0}
            >
              {scheduledAt ? "Agendar Publicação" : "Publicar Agora"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {text && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pré-visualização</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-gray-50 p-4">
              <p className="whitespace-pre-wrap text-sm">{text}</p>
              {mediaFiles.length > 0 && (
                <p className="mt-2 text-xs text-gray-400">
                  {mediaFiles.length} imagem(s) anexada(s)
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
