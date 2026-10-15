import get from "es-toolkit/compat/get";
import { Hyperbrowser } from "@hyperbrowser/sdk";
import { providerOptions, stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { fetchOne, providerResult } from "./utils";

type HyperbrowserFetchOptions = { outputs?: Record<string, unknown> };

export const hyperbrowser: FetchProvider = {
  id: "hyperbrowser",
  weight: 56,
  formats: ["html", "markdown"],
  run: fetchOne(async (key, url, signal, ctx, format) => {
    const options = providerOptions<HyperbrowserFetchOptions>(
      ctx,
      "hyperbrowser",
      "fetch",
    );
    const client = new Hyperbrowser({
      apiKey: requireKey("hyperbrowser", key),
    });
    const payload = await sdkRequest(signal, () =>
      client.web.fetch({
        ...options,
        url,
        outputs: {
          ...options.outputs,
          formats: [format as "html" | "markdown"],
        },
      }),
    );
    return providerResult(stringValue(get(payload, ["data", format])), format);
  }),
};
