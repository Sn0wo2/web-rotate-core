import { Readability } from "@mozilla/readability";
import { Defuddle } from "defuddle/node";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";
import type { FetchFormat } from "./util";

const markdown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

export async function cleanHTML(
  html: string,
  url: string,
  format: FetchFormat,
  cleanup: "defuddle" | "readability",
): Promise<string> {
  if (!/<\/?[a-z][\w:-]*(?:\s[^<>]*?)?>/i.test(html)) return html;
  const { document } = parseHTML(html);
  Object.defineProperties(document, {
    URL: { configurable: true, value: url },
    documentURI: { configurable: true, value: url },
    baseURI: { configurable: true, value: url },
  });

  if (cleanup === "defuddle") {
    const result = await Defuddle(document, url, {
      markdown: format === "markdown",
      useAsync: false,
    });
    const htmlContent = result.content ?? html;
    return (
      (format === "markdown"
        ? (result.contentMarkdown ?? htmlContent)
        : format === "text"
          ? (parseHTML(htmlContent)
              .document.documentElement?.textContent?.replace(/\s+/g, " ")
              .trim() ?? "")
          : htmlContent) || html
    );
  }
  const result = new Readability(document).parse();
  if (!result) return html;
  const articleHTML = result.content ?? html;
  return (
    (format === "markdown"
      ? markdown.turndown(articleHTML)
      : format === "text"
        ? (result.textContent ??
          parseHTML(html)
            .document.documentElement?.textContent?.replace(/\s+/g, " ")
            .trim() ??
          "")
        : articleHTML) || html
  );
}
