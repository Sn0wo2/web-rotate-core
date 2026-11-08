import { Readability } from "@mozilla/readability"
import { parseDocument } from "../dom"

export function run(html: string, url: string) {
  const { document } = parseDocument(html, url)
  const article = new Readability(document).parse()
  return { html: article?.content ?? "" }
}
