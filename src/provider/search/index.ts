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
import { deepseek } from "./deepseek";
import { openai } from "./openai";
import { native } from "./native";

type Registered<P, ID extends string> = Omit<P, "id"> & { id: ID };

export const SEARCH_PROVIDERS = [
  perplexity as Registered<typeof perplexity, "perplexity">,
  octen as Registered<typeof octen, "octen">,
  tavily as Registered<typeof tavily, "tavily">,
  parallel as Registered<typeof parallel, "parallel">,
  you as Registered<typeof you, "you">,
  nimble as Registered<typeof nimble, "nimble">,
  exa as Registered<typeof exa, "exa">,
  brave as Registered<typeof brave, "brave">,
  hyperbrowser as Registered<typeof hyperbrowser, "hyperbrowser">,
  firecrawl as Registered<typeof firecrawl, "firecrawl">,
  tinyfish as Registered<typeof tinyfish, "tinyfish">,
  keenable as Registered<typeof keenable, "keenable">,
  serper as Registered<typeof serper, "serper">,
  bocha as Registered<typeof bocha, "bocha">,
  jina as Registered<typeof jina, "jina">,
  scrapingbee as Registered<typeof scrapingbee, "scrapingbee">,
  diffbot as Registered<typeof diffbot, "diffbot">,
  brightdata as Registered<typeof brightdata, "brightdata">,
  linkup as Registered<typeof linkup, "linkup">,
  doubao as Registered<typeof doubao, "doubao">,
  deepseek as Registered<typeof deepseek, "deepseek">,
  openai as Registered<typeof openai, "openai">,
  native as Registered<typeof native, "native">,
] as const;
