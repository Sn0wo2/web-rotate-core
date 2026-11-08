import { extract } from "trafilatura"

export function run(html: string, url: string, markdown: boolean) {
  const result = extract(html, {
    url,
    includeLinks: true,
    includeTables: true,
    ...(markdown ? { outputMarkdown: true } : {}),
  })
  return {
    html: result?.contentHtml ?? "",
    markdown: result?.contentMarkdown?.trim() ? result.contentMarkdown : undefined,
  }
}
