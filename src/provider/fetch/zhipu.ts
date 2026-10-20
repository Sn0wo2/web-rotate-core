import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { z } from "zod";
import { apiJSON } from "../../shared/http";
import { stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey } from "../utils";
import { fetchOne, providerResult } from "./utils";

const BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

const settingsSchema = z.looseObject({
  baseUrl: z.string().optional(),
});
type ZhipuFetchSettings = z.output<typeof settingsSchema>;

export const zhipu = {
  id: "zhipu",
  weight: 60,
  formats: ["markdown", "text"],
  options: settingsSchema,
  run: fetchOne<ZhipuFetchSettings>(
    async ({ settings, key, url, signal, format }) => {
      const { baseUrl: configuredBaseUrl, ...options } = settings;
      const baseUrl = stringValue(configuredBaseUrl) ?? BASE_URL;
      const payload = await apiJSON(
        `${baseUrl.replace(/\/+$/, "")}/reader`,
        signal,
        {
          label: "zhipu web reader",
          body: {
            ...options,
            url,
            return_format: format === "text" ? "text" : "markdown",
          },
          key: requireKey("zhipu", key),
        },
      );
      const result =
        isRecord(payload) && isRecord(payload.reader_result)
          ? payload.reader_result
          : {};
      const title = stringValue(result.title);
      const finalURL = stringValue(result.url);
      return {
        ...providerResult(result.content, format),
        ...(title ? { title } : {}),
        ...(finalURL ? { finalURL } : {}),
      };
    },
  ),
} satisfies FetchProvider<ZhipuFetchSettings>;
