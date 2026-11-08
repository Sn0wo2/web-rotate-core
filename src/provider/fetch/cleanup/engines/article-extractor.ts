import { extractFromHtml } from "@extractus/article-extractor"

export async function run(html: string, url: string) {
  const article = await extractFromHtml(html, url)
  return { html: article?.content ?? "" }
}
