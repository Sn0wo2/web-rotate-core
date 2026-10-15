import { fileTypeFromBuffer } from "file-type";
import { TARGET_USER_AGENT, readBodyLimited } from "../../shared/http";
import type { URLList } from "../../shared/types";
import type { FetchOutcome } from "./types";
import { fetchManualRedirects } from "./utils";

const IMAGE_EXT =
  /\.(?:avif|bmp|gif|heic|heif|ico|jfif|jpe?g|png|tiff?|webp)$/i;

const IMAGE_MIMES = new Set([
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
]);

export async function fetchImage(
  urls: URLList,
  signal: AbortSignal,
  nativeEnabled: boolean,
  nativeOnly: boolean,
): Promise<FetchOutcome | undefined> {
  if (
    !nativeEnabled ||
    urls.length !== 1 ||
    (!nativeOnly && !IMAGE_EXT.test(new URL(urls[0]).pathname))
  )
    return undefined;
  try {
    const { response, url } = await fetchManualRedirects(
      urls[0],
      signal,
      { Accept: "image/*,*/*;q=0.1", "User-Agent": TARGET_USER_AGENT },
      "native image",
      "web-rotate",
      5,
    );
    const contentType =
      response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase() ?? "";
    if (
      !contentType.startsWith("image/") ||
      contentType === "image/svg+xml" ||
      contentType === "image/vnd.fastbidsheet"
    ) {
      await response.body?.cancel();
      return undefined;
    }
    const body = await readBodyLimited(
      response,
      Math.floor((5 * 1024 * 1024 * 3) / 4),
      "native image",
    );
    const mime = (await fileTypeFromBuffer(body))?.mime;
    if (!mime || !IMAGE_MIMES.has(mime)) return undefined;
    const base64 = body.toBase64();
    if (base64.length > 5 * 1024 * 1024) return undefined;
    return { type: "image", url, mime, base64 };
  } catch (error) {
    if (signal.aborted) throw error;
    return undefined;
  }
}
