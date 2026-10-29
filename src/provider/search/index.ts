import { bocha } from "./bocha"
import { brave } from "./brave"
import { brightdata } from "./brightdata"
import { deepseek } from "./deepseek"
import { diffbot } from "./diffbot"
import { doubao } from "./doubao"
import { exa } from "./exa"
import { firecrawl } from "./firecrawl"
import { hyperbrowser } from "./hyperbrowser"
import { jina } from "./jina"
import { keenable } from "./keenable"
import { linkup } from "./linkup"
import { native } from "./native"
import { nimble } from "./nimble"
import { octen } from "./octen"
import { openai } from "./openai"
import { parallel } from "./parallel"
import { perplexity } from "./perplexity"
import { scrapingbee } from "./scrapingbee"
import { serper } from "./serper"
import { tavily } from "./tavily"
import { tinyfish } from "./tinyfish"
import { you } from "./you"
import { zhipu } from "./zhipu"

type Registered<P, ID extends string> = Omit<P, "id"> & { id: ID }

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
  zhipu as Registered<typeof zhipu, "zhipu">,
] as const
