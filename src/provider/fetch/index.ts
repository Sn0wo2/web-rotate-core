import type { FetchProvider } from "./types";
import { tavily } from "./tavily";
import { parallel } from "./parallel";
import { you } from "./you";
import { exa } from "./exa";
import { hyperbrowser } from "./hyperbrowser";
import { firecrawl } from "./firecrawl";
import { tinyfish } from "./tinyfish";
import { jina } from "./jina";
import { scrapingant } from "./scrapingant";
import { scrapingbee } from "./scrapingbee";
import { scrapfly } from "./scrapfly";
import { diffbot } from "./diffbot";
import { brightdata } from "./brightdata";
import { apify } from "./apify";
import { linkup } from "./linkup";
import { native } from "./native";

/** 顺序与历史 WEBFETCH_PROVIDERS 保持一致（weight 相同时按此稳定排序） */
export const FETCH_PROVIDERS: readonly FetchProvider[] = [
  tavily,
  parallel,
  you,
  exa,
  hyperbrowser,
  firecrawl,
  tinyfish,
  jina,
  scrapingant,
  scrapingbee,
  scrapfly,
  diffbot,
  brightdata,
  apify,
  linkup,
  native,
];
