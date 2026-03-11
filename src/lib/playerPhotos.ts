import { supabase } from "./supabase";

const PHOTO_BUCKET = "player-photos";
const DOCUMENT_BUCKET = "player-documents";
const MANAGEMENT_DOCUMENT_BUCKET = "management-documents";

type PlayerDocumentType = "birth-certificate" | "report-card";
type ManagementDocumentCategory =
  | "insurance"
  | "agreement"
  | "receipt"
  | "finance"
  | "other";

async function uploadPublicFile(
  bucket: string,
  filePath: string,
  file: File
): Promise<string> {
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error("Unable to generate public URL for uploaded file.");
  }

  return data.publicUrl;
}

export async function uploadPlayerPhoto(
  file: File,
  playerId: string
): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";
  const filePath = `${playerId}/${Date.now()}.${safeExtension}`;

  return uploadPublicFile(PHOTO_BUCKET, filePath, file);
}

export async function uploadPlayerDocument(
  file: File,
  playerId: string,
  documentType: PlayerDocumentType
): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "pdf";
  const filePath = `${playerId}/${documentType}-${Date.now()}.${safeExtension}`;

  return uploadPublicFile(DOCUMENT_BUCKET, filePath, file);
}

export async function uploadManagementDocument(
  file: File,
  title: string,
  category: ManagementDocumentCategory
): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "pdf";
  const safeTitle =
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "document";
  const filePath = `${Date.now()}__${category}__${safeTitle}.${safeExtension}`;

  return uploadPublicFile(MANAGEMENT_DOCUMENT_BUCKET, filePath, file);
}
