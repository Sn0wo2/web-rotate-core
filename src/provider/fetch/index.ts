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
import { deepseek } from "./deepseek";
import { bocha } from "./bocha";
import { native } from "./native";

type Registered<P, ID extends string> = Omit<P, "id"> & { id: ID };

export const FETCH_PROVIDERS = [
  tavily as Registered<typeof tavily, "tavily">,
  parallel as Registered<typeof parallel, "parallel">,
  you as Registered<typeof you, "you">,
  exa as Registered<typeof exa, "exa">,
  hyperbrowser as Registered<typeof hyperbrowser, "hyperbrowser">,
  firecrawl as Registered<typeof firecrawl, "firecrawl">,
  tinyfish as Registered<typeof tinyfish, "tinyfish">,
  jina as Registered<typeof jina, "jina">,
  scrapingant as Registered<typeof scrapingant, "scrapingant">,
  scrapingbee as Registered<typeof scrapingbee, "scrapingbee">,
  scrapfly as Registered<typeof scrapfly, "scrapfly">,
  diffbot as Registered<typeof diffbot, "diffbot">,
  brightdata as Registered<typeof brightdata, "brightdata">,
  apify as Registered<typeof apify, "apify">,
  linkup as Registered<typeof linkup, "linkup">,
  deepseek as Registered<typeof deepseek, "deepseek">,
  bocha as Registered<typeof bocha, "bocha">,
  native as Registered<typeof native, "native">,
] as const;
