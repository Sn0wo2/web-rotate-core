import { Readability } from "@mozilla/readability";
import { Defuddle } from "defuddle/node";
import { parseHTML } from "linkedom";
import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "@truto/turndown-plugin-gfm";
import type { FetchFormat } from "./core/types";

export async function convertContent(
  content: string,
  source: FetchFormat,
  url: string,
  format: FetchFormat,
  cleanup: "none" | "defuddle" | "readability",
): Promise<{ content: string; format: FetchFormat }> {
  if (!content.trim()) throw new Error("empty content");
  if (format === "html" && source !== "html")
    throw new Error(`cannot return original HTML from ${source}`);
  if (source === "text" || (source === "markdown" && format === "markdown"))
    return { content, format: source };
  if (source === "html" && format === "html" && cleanup === "none")
    return { content, format };
  let html =
    source === "markdown" ? marked.parse(content, { async: false }) : content;
  let { document } = parseHTML(html);
  Object.defineProperties(document, {
    URL: { configurable: true, value: url },
    documentURI: { configurable: true, value: url },
    baseURI: { configurable: true, value: url },
  });
  if (source === "html" && cleanup !== "none") {
    if (cleanup === "defuddle") {
      const result = await Defuddle(document, url, {
        markdown: format === "markdown",
        useAsync: false,
      });
      if (format === "markdown" && result.contentMarkdown?.trim())
        return { content: result.contentMarkdown, format };
      html = result.content || html;
    } else html = new Readability(document).parse()?.content || html;
    if (format === "html") return { content: html, format };
    ({ document } = parseHTML(html));
  }
  for (const node of document.querySelectorAll("script, style, template"))
    node.remove();
  for (const node of document.querySelectorAll("a[href], img[src]")) {
    const attribute = node.tagName === "A" ? "href" : "src";
    const value = node.getAttribute(attribute);
    if (!value) continue;
    try {
      node.setAttribute(attribute, new URL(value, url).href);
    } catch {}
  }
  if (format === "markdown") {
    const result = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    })
      .use(gfm)
      .keep(["table"])
      .turndown(document.toString());
    if (!result.trim()) throw new Error("no markdown content");
    return { content: result, format };
  }
  for (const node of document.querySelectorAll("a[href]")) {
    const href = node.getAttribute("href");
    if (!href || node.textContent?.includes(href)) continue;
    try {
      node.append(document.createTextNode(` (${new URL(href, url).href})`));
    } catch {}
  }
  for (const node of document.querySelectorAll("img[alt]"))
    node.replaceWith(document.createTextNode(node.getAttribute("alt") ?? ""));
  for (const node of document.querySelectorAll('input[type="checkbox"]'))
    node.replaceWith(
      document.createTextNode(node.hasAttribute("checked") ? "[x] " : "[ ] "),
    );
  for (const node of document.querySelectorAll("td, th"))
    node.append(document.createTextNode("\t"));
  for (const node of document.querySelectorAll("br, hr"))
    node.replaceWith(document.createTextNode("\n"));
  for (const node of document.querySelectorAll(
    "p, div, section, article, header, footer, h1, h2, h3, h4, h5, h6, li, tr, pre, blockquote",
  ))
    node.append(document.createTextNode("\n"));
  const result = Array.from(
    document.childNodes,
    (node) => node.textContent ?? "",
  )
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!result) throw new Error("no text content");
  return { content: result, format };
}
