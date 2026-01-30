"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CancelButton({ postId, postChannelId }: { postId: string; postChannelId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm("Tem a certeza que pretende cancelar esta publicação?")) return;
    setLoading(true);

    await fetch(`/api/posts/${postId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postChannelId }),
    });

    setLoading(false);
    router.refresh();
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleCancel} disabled={loading}>
      {loading ? "A cancelar..." : "Cancelar"}
    </Button>
  );
}
