import { extract } from "@firecrawl/html-extractor"

export async function run(html: string, url: string) {
  const result = await extract(html, {
    url,
    includeLinks: true,
    includeTables: true,
  })
  return { markdown: result?.markdown ?? "" }
}
