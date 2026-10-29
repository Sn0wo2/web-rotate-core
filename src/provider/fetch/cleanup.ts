import { gfm } from "@truto/turndown-plugin-gfm"
import { Defuddle } from "defuddle/node"
import { convert } from "html-to-text"
import { parseHTML } from "linkedom"
import { marked } from "marked"
import TurndownService from "turndown"
import type { FetchFormat } from "./types"

export async function convertContent(
  content: string,
  source: FetchFormat,
  url: string,
  format: FetchFormat,
  cleanup: "none" | "defuddle",
): Promise<{ content: string; format: FetchFormat }> {
  if (!content.trim()) throw new Error("empty content")
  if (format === "html" && source !== "html") throw new Error(`cannot return original HTML from ${source}`)
  if (source === "text" || (source === "markdown" && format === "markdown")) return { content, format: source }
  if (source === "html" && format === "html" && cleanup === "none") return { content, format }
  let html = source === "markdown" ? marked.parse(content, { async: false }) : content
  if (source === "html" && cleanup !== "none") {
    const { document } = parseHTML(html)
    Object.defineProperties(document, {
      URL: { configurable: true, value: url },
      documentURI: { configurable: true, value: url },
      baseURI: { configurable: true, value: url },
    })
    const result = await Defuddle(document, url, {
      markdown: format === "markdown",
      useAsync: false,
    })
    if (format === "markdown" && result.contentMarkdown?.trim()) return { content: result.contentMarkdown, format }
    html = result.content || html
    if (format === "html") return { content: html, format }
  }
  if (format === "markdown") {
    const { document } = parseHTML(html)
    for (const node of document.querySelectorAll("script, style, template")) node.remove()
    for (const node of document.querySelectorAll("a[href], img[src]")) {
      const attribute = node.tagName === "A" ? "href" : "src"
      const value = node.getAttribute(attribute)
      if (!value) continue
      try {
        node.setAttribute(attribute, new URL(value, url).href)
      } catch {}
    }
    const markdown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    })
      .use(gfm)
      .keep(["table"])
      .turndown(document.toString())
    if (!markdown.trim()) throw new Error("no markdown content")
    return { content: markdown, format }
  }
  const text = convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "h1", options: { uppercase: false } },
      { selector: "h2", options: { uppercase: false } },
      { selector: "h3", options: { uppercase: false } },
      { selector: "h4", options: { uppercase: false } },
      { selector: "h5", options: { uppercase: false } },
      { selector: "h6", options: { uppercase: false } },
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "table", format: "dataTable" },
    ],
  })
  if (!text.trim()) throw new Error("no text content")
  return { content: text, format }
}
