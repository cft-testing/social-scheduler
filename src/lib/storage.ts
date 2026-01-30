import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export interface StorageDriver {
  upload(buffer: Buffer, filename: string, mimeType: string): Promise<string>;
  delete(url: string): Promise<void>;
}

class LocalStorageDriver implements StorageDriver {
  private uploadDir = join(process.cwd(), "public", "uploads");

  async upload(buffer: Buffer, filename: string, _mimeType: string): Promise<string> {
    await mkdir(this.uploadDir, { recursive: true });
    const ext = filename.split(".").pop() || "bin";
    const storedName = `${randomUUID()}.${ext}`;
    const filePath = join(this.uploadDir, storedName);
    await writeFile(filePath, buffer);
    return `/uploads/${storedName}`;
  }

  async delete(url: string): Promise<void> {
    const filename = url.split("/").pop();
    if (!filename) return;
    const filePath = join(this.uploadDir, filename);
    try {
      await unlink(filePath);
    } catch {
      // File may not exist
    }
  }
}

class S3StorageDriver implements StorageDriver {
  async upload(_buffer: Buffer, _filename: string, _mimeType: string): Promise<string> {
    // S3 upload skeleton — implement with AWS SDK when needed
    throw new Error("S3 storage not yet implemented. Configure S3 environment variables.");
  }

  async delete(_url: string): Promise<void> {
    throw new Error("S3 storage not yet implemented.");
  }
}

export function getStorage(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER || "local";
  if (driver === "s3") return new S3StorageDriver();
  return new LocalStorageDriver();
}
