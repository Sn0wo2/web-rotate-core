import { isPlainObject as isRecord } from "es-toolkit/predicate";
import {
  apiJSON,
  checkedResponseText,
  TARGET_USER_AGENT,
  USER_AGENT,
} from "../../shared/http";
import { providerOptions } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey, urlParams } from "../utils";
import { fetchOne, providerResult } from "./utils";

export const scrapingant: FetchProvider = {
  id: "scrapingant",
  weight: 69,
  formats: ["html", "markdown", "text"],
  run: fetchOne(async (key, url, signal, ctx, format) => {
    const endpoint = urlParams(
      new URL(
        format === "html"
          ? "https://api.scrapingant.com/v2/general"
          : `https://api.scrapingant.com/v2/${format === "text" ? "extended" : "markdown"}`,
      ),
      {
        browser: "true",
        proxy_type: "datacenter",
        ...providerOptions(ctx, "scrapingant", "fetch"),
      },
    );
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("x-api-key", requireKey("scrapingant", key));
    if (format === "html") {
      return providerResult(
        await checkedResponseText(
          await fetch(endpoint, {
            headers: {
              Accept: "text/html, */*;q=0.1",
              "User-Agent": USER_AGENT,
              "Ant-Custom-Header-User-Agent": TARGET_USER_AGENT,
            },
            signal,
            redirect: "error",
          }),
          "scrapingant",
        ),
        "html",
      );
    }
    const payload = await apiJSON(endpoint.toString(), signal, {
      label: "scrapingant",
      headers: { "Ant-Custom-Header-User-Agent": TARGET_USER_AGENT },
    });
    return providerResult(
      isRecord(payload)
        ? payload[format === "text" ? "text" : "markdown"]
        : undefined,
      format,
    );
  }),
};
