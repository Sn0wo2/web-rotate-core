import { Defuddle } from "defuddle/node"
import { parseDocument } from "../dom"

export async function run(html: string, url: string, markdown: boolean) {
  const { document } = parseDocument(html, url)
  const result = await Defuddle(document, url, {
    markdown,
    separateMarkdown: markdown,
    useAsync: false,
  })
  return {
    html: result.content ?? "",
    markdown: result.contentMarkdown?.trim() ? result.contentMarkdown : undefined,
  }
}
