import { gfm } from "@truto/turndown-plugin-gfm"
import { marked } from "marked"
import TurndownService from "turndown"
import { parseDocument } from "./dom"

export function markdownToHTML(content: string): string {
  return marked.parse(content, { async: false })
}

export function htmlToMarkdown(html: string, url: string): string {
  const { document } = parseDocument(html)
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
  return markdown
}
