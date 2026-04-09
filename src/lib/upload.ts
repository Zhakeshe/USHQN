import { supabase } from './supabase'

const BUCKET = 'uploads'

export async function uploadPublicFile(
  userId: string,
  path: string,
  file: File,
): Promise<string | null> {
  const fullPath = `${userId}/${path}`.replace(/\/+/g, '/')
  const { error } = await supabase.storage.from(BUCKET).upload(fullPath, file, {
    upsert: true,
  })
  if (error) {
    console.error(error)
    return null
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fullPath)
  return data.publicUrl
}
