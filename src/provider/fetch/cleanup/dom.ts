import { parseHTML } from "linkedom"

export function parseDocument(html: string, url?: string) {
  const { document } = parseHTML(html)
  if (url) {
    let baseURI = url
    const baseHref = document.querySelector("base[href]")?.getAttribute("href")
    if (baseHref) {
      try {
        baseURI = new URL(baseHref, url).href
      } catch {}
    }
    Object.defineProperties(document, {
      URL: { configurable: true, value: url },
      documentURI: { configurable: true, value: url },
      baseURI: { configurable: true, value: baseURI },
    })
  }
  return { document }
}
