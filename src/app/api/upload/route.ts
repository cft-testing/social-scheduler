import { NextRequest, NextResponse } from "next/server";
import { requireAuthApi } from "@/lib/auth-guard";
import { getStorage } from "@/lib/storage";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuthApi();
  if (error) return error;
  void session;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Ficheiro não enviado" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Tipo não suportado. Permitidos: ${ALLOWED_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ficheiro demasiado grande (máx. 10MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  const url = await storage.upload(buffer, file.name, file.type);

  return NextResponse.json({
    url,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });
}
