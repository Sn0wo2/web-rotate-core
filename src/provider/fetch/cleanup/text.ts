import { convert } from "html-to-text"

export function htmlToText(html: string): string {
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
  return text
}
