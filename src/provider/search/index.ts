import { perplexity } from "./perplexity";
import { octen } from "./octen";
import { tavily } from "./tavily";
import { parallel } from "./parallel";
import { you } from "./you";
import { nimble } from "./nimble";
import { exa } from "./exa";
import { brave } from "./brave";
import { hyperbrowser } from "./hyperbrowser";
import { firecrawl } from "./firecrawl";
import { tinyfish } from "./tinyfish";
import { keenable } from "./keenable";
import { serper } from "./serper";
import { bocha } from "./bocha";
import { jina } from "./jina";
import { scrapingbee } from "./scrapingbee";
import { diffbot } from "./diffbot";
import { brightdata } from "./brightdata";
import { linkup } from "./linkup";
import { doubao } from "./doubao";
import { openai } from "./openai";
import { native } from "./native";

export const SEARCH_PROVIDERS = [
  perplexity,
  octen,
  tavily,
  parallel,
  you,
  nimble,
  exa,
  brave,
  hyperbrowser,
  firecrawl,
  tinyfish,
  keenable,
  serper,
  bocha,
  jina,
  scrapingbee,
  diffbot,
  brightdata,
  linkup,
  doubao,
  openai,
  native,
] as const;
