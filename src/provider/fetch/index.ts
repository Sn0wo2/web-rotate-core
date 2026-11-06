import { apify } from "./apify"
import { bocha } from "./bocha"
import { brightdata } from "./brightdata"
import { claude } from "./claude"
import { deepseek } from "./deepseek"
import { diffbot } from "./diffbot"
import { doubao } from "./doubao"
import { exa } from "./exa"
import { firecrawl } from "./firecrawl"
import { gemini } from "./gemini"
import { hyperbrowser } from "./hyperbrowser"
import { jina } from "./jina"
import { keenable } from "./keenable"
import { linkup } from "./linkup"
import { native } from "./native"
import { nimble } from "./nimble"
import { octen } from "./octen"
import { parallel } from "./parallel"
import { scrapfly } from "./scrapfly"
import { scrapingant } from "./scrapingant"
import { scrapingbee } from "./scrapingbee"
import { serper } from "./serper"
import { tavily } from "./tavily"
import { tinyfish } from "./tinyfish"
import { you } from "./you"
import { zhipu } from "./zhipu"

type Registered<P, ID extends string> = Omit<P, "id"> & { id: ID }

export const FETCH_PROVIDERS = [
  tavily as Registered<typeof tavily, "tavily">,
  parallel as Registered<typeof parallel, "parallel">,
  you as Registered<typeof you, "you">,
  exa as Registered<typeof exa, "exa">,
  hyperbrowser as Registered<typeof hyperbrowser, "hyperbrowser">,
  firecrawl as Registered<typeof firecrawl, "firecrawl">,
  tinyfish as Registered<typeof tinyfish, "tinyfish">,
  jina as Registered<typeof jina, "jina">,
  keenable as Registered<typeof keenable, "keenable">,
  nimble as Registered<typeof nimble, "nimble">,
  octen as Registered<typeof octen, "octen">,
  serper as Registered<typeof serper, "serper">,
  scrapingant as Registered<typeof scrapingant, "scrapingant">,
  scrapingbee as Registered<typeof scrapingbee, "scrapingbee">,
  scrapfly as Registered<typeof scrapfly, "scrapfly">,
  diffbot as Registered<typeof diffbot, "diffbot">,
  brightdata as Registered<typeof brightdata, "brightdata">,
  apify as Registered<typeof apify, "apify">,
  linkup as Registered<typeof linkup, "linkup">,
  deepseek as Registered<typeof deepseek, "deepseek">,
  bocha as Registered<typeof bocha, "bocha">,
  doubao as Registered<typeof doubao, "doubao">,
  claude as Registered<typeof claude, "claude">,
  gemini as Registered<typeof gemini, "gemini">,
  native as Registered<typeof native, "native">,
  zhipu as Registered<typeof zhipu, "zhipu">,
] as const
