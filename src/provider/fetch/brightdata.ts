import { z } from "zod";
import { checkedResponseText, USER_AGENT } from "../../shared/http";
import type { FetchProvider } from "./types";
import { requireKey } from "../utils";
import { fetchOne, providerResult } from "./utils";

const settingsSchema = z.looseObject({ zone: z.string().optional() });
type BrightdataSettings = z.output<typeof settingsSchema>;

export const brightdata = {
  id: "brightdata",
  weight: 62,
  formats: ["html", "markdown"],
  options: settingsSchema,
  run: fetchOne<BrightdataSettings>(
    async ({ settings, key, url, signal, format }) => {
      const { zone, ...options } = settings;
      if (!zone?.trim()) throw new Error("brightdata zone is not configured");
      return providerResult(
        await checkedResponseText(
          await fetch("https://api.brightdata.com/request", {
            method: "POST",
            headers: {
              Accept: "text/markdown, text/plain;q=0.9",
              Authorization: `Bearer ${requireKey("brightdata", key)}`,
              "Content-Type": "application/json",
              "User-Agent": USER_AGENT,
            },
            body: JSON.stringify({
              render: "true",
              ...options,
              zone,
              url,
              format: "raw",
              ...(format === "markdown" ? { data_format: "markdown" } : {}),
            }),
            signal,
            redirect: "error",
          }),
          "brightdata",
        ),
        format,
      );
    },
  ),
} satisfies FetchProvider<BrightdataSettings>;
