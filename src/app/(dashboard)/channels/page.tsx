"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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

interface OAuthConfig {
  metaConfigured: boolean;
  linkedinConfigured: boolean;
}

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  FB_PAGE: "Página Facebook",
  IG_BUSINESS: "Instagram Business",
  LI_ORG: "Organização LinkedIn",
  LI_PROFILE: "Perfil LinkedIn",
};

export default function ChannelsPage() {
  const searchParams = useSearchParams();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [config, setConfig] = useState<OAuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Handle success/error from OAuth callback
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const count = searchParams.get("count");

    if (success === "meta") {
      setMessage({ type: "success", text: `Contas Meta conectadas com sucesso! (${count || "?"} canais)` });
    } else if (success === "linkedin") {
      setMessage({ type: "success", text: `Contas LinkedIn conectadas com sucesso! (${count || "?"} canais)` });
    } else if (error) {
      setMessage({ type: "error", text: decodeURIComponent(error) });
    }

    // Clear URL params after reading
    if (success || error) {
      window.history.replaceState({}, "", "/channels");
    }
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      fetch("/api/channels").then((r) => r.json()),
      fetch("/api/channels/config").then((r) => r.json()),
    ])
      .then(([channelsData, configData]) => {
        setChannels(channelsData.channels || []);
        setConfig(configData);
      })
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

  function handleConnect(provider: "meta" | "linkedin") {
    window.location.href = `/api/channels/${provider}`;
  }

  function handleReconnect(channel: Channel) {
    const provider = channel.provider === "META" ? "meta" : "linkedin";
    window.location.href = `/api/channels/${provider}`;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Canais</h1>

      {message && (
        <div
          className={`rounded-md p-4 text-sm ${
            message.type === "success"
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-2 font-medium underline"
          >
            Fechar
          </button>
        </div>
      )}

      {!config?.metaConfigured && !config?.linkedinConfigured && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          <strong>Nota:</strong> A ligação OAuth a contas Meta (Facebook/Instagram) e LinkedIn requer configuração das
          credenciais da aplicação nas variáveis de ambiente. Consulte o ficheiro .env.example para detalhes.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Canais Conectados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">A carregar...</p>
          ) : channels.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum canal conectado. Use os botões abaixo para ligar as suas contas.</p>
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
                    {channel.needsReconnect && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReconnect(channel)}
                      >
                        Reconectar
                      </Button>
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
              {config?.metaConfigured
                ? "Ligar as suas páginas do Facebook e contas Instagram Business."
                : "Configure META_APP_ID e META_APP_SECRET nas variáveis de ambiente para ativar."}
            </p>
            <Button
              variant="outline"
              className="mt-2"
              disabled={!config?.metaConfigured}
              onClick={() => handleConnect("meta")}
            >
              {config?.metaConfigured ? "Ligar conta Meta" : "Ligar conta Meta (requer configuração)"}
            </Button>
          </div>
          <div className="rounded-md border p-4">
            <h3 className="font-medium">LinkedIn</h3>
            <p className="mt-1 text-sm text-gray-500">
              {config?.linkedinConfigured
                ? "Ligar o seu perfil LinkedIn e organizações que administra."
                : "Configure LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET nas variáveis de ambiente para ativar."}
            </p>
            <Button
              variant="outline"
              className="mt-2"
              disabled={!config?.linkedinConfigured}
              onClick={() => handleConnect("linkedin")}
            >
              {config?.linkedinConfigured ? "Ligar conta LinkedIn" : "Ligar conta LinkedIn (requer configuração)"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
