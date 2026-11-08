import { fileTypeFromBuffer } from "file-type"
import { readBodyLimited, TARGET_USER_AGENT } from "../../shared/http"
import type { URLList } from "../../shared/types"
import type { AttemptDiagnostics } from "../types"
import type { FetchOutcome } from "./types"
import { fetchManualRedirects } from "./utils"

const IMAGE_EXT = /\.(?:avif|bmp|gif|heic|heif|ico|jfif|jpe?g|png|tiff?|webp)$/i

export async function fetchImage(
  urls: URLList,
  signal: AbortSignal,
  nativeEnabled: boolean,
  nativeOnly: boolean,
): Promise<{ outcome?: FetchOutcome; attempts: AttemptDiagnostics[] }> {
  if (!nativeEnabled || urls.length !== 1 || !(nativeOnly || IMAGE_EXT.test(new URL(urls[0]).pathname)))
    return { attempts: [] }
  const started = performance.now()
  const failedAttempt = (error: string): { outcome?: FetchOutcome; attempts: AttemptDiagnostics[] } => {
    return {
      attempts: [
        {
          provider: "native",
          keyless: true,
          urls: [...urls],
          durationMs: Math.round(performance.now() - started),
          ok: false,
          error,
        },
      ],
    }
  }
  try {
    const { response, url } = await fetchManualRedirects(
      urls[0],
      signal,
      { Accept: "image/*,*/*;q=0.1", "User-Agent": TARGET_USER_AGENT },
      "native image",
      "web-rotate",
      5,
    )
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? ""
    if (
      !contentType.startsWith("image/") ||
      contentType === "image/svg+xml" ||
      contentType === "image/vnd.fastbidsheet"
    ) {
      await response.body?.cancel()
      return failedAttempt(`response is not a supported image (content-type "${contentType || "unknown"}")`)
    }
    const body = await readBodyLimited(response, Math.floor((5 * 1024 * 1024 * 3) / 4), "native image")
    const mime = (await fileTypeFromBuffer(body))?.mime
    if (
      !(
        mime &&
        [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "image/bmp",
          "image/tiff",
          "image/x-icon",
          "image/avif",
          "image/heic",
          "image/heif",
        ].includes(mime)
      )
    )
      return failedAttempt("downloaded content is not a supported image")
    const base64 = body.toBase64()
    if (base64.length > 5 * 1024 * 1024) return failedAttempt("image exceeds the 5 MB size limit")
    const attempt: AttemptDiagnostics = {
      provider: "native",
      keyless: true,
      urls: [...urls],
      durationMs: Math.round(performance.now() - started),
      ok: true,
    }
    return {
      outcome: { type: "image", url, mime, base64, provider: "native", attempts: [attempt] },
      attempts: [attempt],
    }
  } catch (error) {
    if (signal.aborted) throw error
    return failedAttempt(error instanceof Error ? error.message : String(error))
  }
}
