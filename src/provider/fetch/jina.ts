import { z } from "zod";
import {
  checkedResponseText,
  TARGET_USER_AGENT,
  USER_AGENT,
} from "../../shared/http";
import type { FetchProvider } from "./types";
import { fetchOne, providerResult } from "./utils";

const settingsSchema = z.looseObject({
  headers: z.record(z.string(), z.string()).optional(),
});
type JinaSettings = z.output<typeof settingsSchema>;

export const jina = {
  id: "jina",
  weight: 66,
  keyless: true,
  formats: ["text", "markdown", "html"],
  options: settingsSchema,
  run: fetchOne<JinaSettings>(
    async ({ settings, key, url, signal, format }) => {
      const { headers } = settings;
      const response = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          Accept:
            format === "html"
              ? "text/html, text/plain;q=0.9"
              : format === "text"
                ? "text/plain"
                : "text/markdown, text/plain;q=0.9",
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
          "User-Agent": USER_AGENT,
          "X-User-Agent": TARGET_USER_AGENT,
          "X-Respond-With": format,
          ...headers,
        },
        signal,
        redirect: "error",
      });
      return providerResult(
        await checkedResponseText(response, "jina"),
        format,
      );
    },
  ),
} satisfies FetchProvider<JinaSettings>;
