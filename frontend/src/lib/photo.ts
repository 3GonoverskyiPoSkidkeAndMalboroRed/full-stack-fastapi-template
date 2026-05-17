import type { ItemPublic } from "@/client"

export const PLACEHOLDER_IMAGE =
  "https://picsum.photos/seed/placeholder/600/600"

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "")

export function getPhotoUrl(relativePath: string): string {
  const cleaned = relativePath.replace(/^\/+/, "")
  return `${API_BASE}/static/${cleaned}`
}

export function firstPhotoOrPlaceholder(
  images: string[] | null | undefined,
): string {
  return images && images.length > 0
    ? getPhotoUrl(images[0])
    : PLACEHOLDER_IMAGE
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("access_token") ?? ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function asJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail: string | undefined
    try {
      const body = (await res.json()) as { detail?: unknown }
      if (typeof body.detail === "string") detail = body.detail
    } catch {
      // ignore
    }
    throw new Error(detail ?? `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export async function uploadItemPhotos(
  itemId: string,
  files: File[],
): Promise<ItemPublic> {
  const fd = new FormData()
  for (const file of files) fd.append("files", file)
  const res = await fetch(`${API_BASE}/api/v1/items/${itemId}/photos`, {
    method: "POST",
    body: fd,
    headers: authHeaders(),
  })
  return asJsonOrThrow<ItemPublic>(res)
}

export async function deleteItemPhoto(
  itemId: string,
  path: string,
): Promise<ItemPublic> {
  const url = new URL(`${API_BASE}/api/v1/items/${itemId}/photos`)
  url.searchParams.set("path", path)
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: authHeaders(),
  })
  return asJsonOrThrow<ItemPublic>(res)
}
