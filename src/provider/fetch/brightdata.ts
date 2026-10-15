import { checkedResponseText, USER_AGENT } from "../../shared/http";
import { providerOptions } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey } from "../utils";
import { fetchOne, providerResult } from "./utils";

type BrightdataOptions = { zone?: string };

export const brightdata: FetchProvider = {
  id: "brightdata",
  weight: 62,
  formats: ["html", "markdown"],
  run: fetchOne(async (key, url, signal, ctx, format) => {
    const { zone, ...options } = providerOptions<BrightdataOptions>(
      ctx,
      "brightdata",
      "fetch",
    );
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
  }),
};
