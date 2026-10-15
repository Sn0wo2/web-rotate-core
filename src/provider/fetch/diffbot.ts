import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { apiJSON } from "../../shared/http";
import { providerOptions } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey, urlParams } from "../utils";
import { fetchOne, providerResult } from "./utils";

export const diffbot: FetchProvider = {
  id: "diffbot",
  weight: 61,
  formats: ["html", "text"],
  run: fetchOne(async (key, url, signal, ctx, format) => {
    const endpoint = urlParams(new URL("https://api.diffbot.com/v3/article"), {
      paging: "false",
      discussion: "false",
      timeout: 30000,
      ...providerOptions(ctx, "diffbot", "fetch"),
    });
    endpoint.searchParams.set("token", requireKey("diffbot", key));
    endpoint.searchParams.set("url", url);
    if (format === "html") endpoint.searchParams.set("fields", "html");
    const payload = await apiJSON(endpoint.toString(), signal, {
      label: "diffbot",
    });
    const item =
      isRecord(payload) &&
      Array.isArray(payload.objects) &&
      isRecord(payload.objects[0])
        ? payload.objects[0]
        : undefined;
    return providerResult(format === "html" ? item?.html : item?.text, format);
  }),
};
