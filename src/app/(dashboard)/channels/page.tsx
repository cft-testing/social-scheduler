"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Channel {
  id: string;
  name: string;
  type: string;
  provider: string;
  connected: boolean;
  needsReconnect: boolean;
  externalId: string | null;
}

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  FB_PAGE: "Página Facebook",
  IG_BUSINESS: "Instagram Business",
  LI_ORG: "Organização LinkedIn",
  LI_PROFILE: "Perfil LinkedIn",
};

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((data) => setChannels(data.channels || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDisconnect(id: string) {
    if (!confirm("Tem a certeza que pretende desconectar este canal?")) return;
    const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
    if (res.ok) {
      setChannels((prev) => prev.filter((c) => c.id !== id));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Canais</h1>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
        <strong>Nota:</strong> A ligação OAuth a contas Meta (Facebook/Instagram) e LinkedIn requer configuração das
        credenciais da aplicação nas variáveis de ambiente. Consulte o ficheiro .env.example para detalhes.
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Canais Conectados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">A carregar...</p>
          ) : channels.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum canal conectado. Execute o seed para criar canais de demonstração.</p>
          ) : (
            <div className="space-y-3">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between rounded-md border p-4"
                >
                  <div>
                    <p className="font-medium">{channel.name}</p>
                    <p className="text-sm text-gray-500">
                      {CHANNEL_TYPE_LABELS[channel.type] || channel.type} &middot; {channel.provider}
                    </p>
                    {channel.needsReconnect && (
                      <Badge variant="warning" className="mt-1">Necessita reconexão</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {channel.connected ? (
                      <Badge variant="success">Conectado</Badge>
                    ) : (
                      <Badge variant="secondary">Desconectado</Badge>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => handleDisconnect(channel.id)}>
                      Desconectar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ligar Novos Canais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-4">
            <h3 className="font-medium">Meta (Facebook / Instagram)</h3>
            <p className="mt-1 text-sm text-gray-500">
              Configure META_APP_ID, META_APP_SECRET e META_REDIRECT_URI no ficheiro .env para ativar a ligação OAuth.
            </p>
            <Button variant="outline" className="mt-2" disabled>
              Ligar conta Meta (requer configuração)
            </Button>
          </div>
          <div className="rounded-md border p-4">
            <h3 className="font-medium">LinkedIn</h3>
            <p className="mt-1 text-sm text-gray-500">
              Configure LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET e LINKEDIN_REDIRECT_URI no ficheiro .env para ativar a ligação OAuth.
            </p>
            <Button variant="outline" className="mt-2" disabled>
              Ligar conta LinkedIn (requer configuração)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
