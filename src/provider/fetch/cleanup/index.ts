import type { CleanupEngine } from "../../../shared/config"
import type { FetchFormat } from "../types"

export type CleanupResult = {
  html?: string | undefined
  markdown?: string | undefined
}

type CleanupEngineID = Exclude<CleanupEngine, "none">

type CleanupEngineModule = {
  run(html: string, url: string, markdown: boolean): Promise<CleanupResult | undefined> | CleanupResult | undefined
}

const ENGINE_PACKAGES: Record<CleanupEngineID, string> = {
  defuddle: "defuddle",
  readability: "@mozilla/readability",
  "article-extractor": "@extractus/article-extractor",
  mercury: "@jocmp/mercury-parser",
  trafilatura: "trafilatura",
  "firecrawl-html": "@firecrawl/html-extractor",
}

const ENGINE_MODULES: Record<CleanupEngineID, () => Promise<CleanupEngineModule>> = {
  defuddle: () => import("./engines/defuddle"),
  readability: () => import("./engines/readability"),
  "article-extractor": () => import("./engines/article-extractor"),
  mercury: () => import("./engines/mercury"),
  trafilatura: () => import("./engines/trafilatura"),
  "firecrawl-html": () => import("./engines/firecrawl-html"),
}

export async function convertContent(
  content: string,
  source: FetchFormat,
  url: string,
  format: FetchFormat,
  cleanup: CleanupEngine,
): Promise<{ content: string; format: FetchFormat }> {
  if (!content.trim()) throw new Error("empty content")
  if (format === "html" && source !== "html") throw new Error(`cannot return original HTML from ${source}`)
  if (source === "text" || (source === "markdown" && format === "markdown")) return { content, format: source }
  if (source === "html" && format === "html" && cleanup === "none") return { content, format }
  let html = source === "markdown" ? (await import("./markdown")).markdownToHTML(content) : content
  if (source === "html" && cleanup !== "none") {
    let result: CleanupResult | undefined
    try {
      result = await (await ENGINE_MODULES[cleanup]()).run(html, url, format === "markdown")
    } catch (error) {
      const code = (error as { code?: string } | null)?.code
      if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND")
        throw new Error(
          `cleanup engine "${cleanup}" requires the "${ENGINE_PACKAGES[cleanup]}" package to be installed`,
          { cause: error },
        )
      throw error
    }
    if (format === "markdown" && result?.markdown?.trim()) return { content: result.markdown, format }
    html = result?.html || html
    if (format === "html") return { content: html, format }
  }
  if (format === "markdown") return { content: await (await import("./markdown")).htmlToMarkdown(html, url), format }
  return { content: (await import("./text")).htmlToText(html), format }
}
