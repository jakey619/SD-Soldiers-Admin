import { supabase } from "./supabase";

const BUCKET = "player-photos";

export async function uploadPlayerPhoto(
  file: File,
  playerId: string
): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";
  const filePath = `${playerId}/${Date.now()}.${safeExtension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error("Unable to generate public URL for uploaded photo.");
  }

  return data.publicUrl;
}