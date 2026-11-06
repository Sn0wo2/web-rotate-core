# Source Notes: WebMainBench

## Source and snapshot

OpenDataLab publishes this benchmark for its own team's MinerU-HTML/Dripper research. The relationship between the benchmark publisher and method authors matters when interpreting the results.

Sources: [repository, methodology, and results](https://github.com/opendatalab/WebMainBench), [dataset](https://huggingface.co/datasets/opendatalab/WebMainBench), and [Dripper: Token-Efficient Main HTML Extraction with a Lightweight LM](https://arxiv.org/abs/2511.23119).

Recorded source check: **2026-11-06**; the repository README returned HTTP 200. The README does not give a common measurement date for all results. Repository update times are not used as a substitute.

## Data and metrics

The full dataset contains 7,809 pages from 5,434 domains in 46 languages. The source describes three rounds of human processing for HTML tag-level annotations: annotation, review, and senior inspection. A detailed 545-page subset provides manually calibrated `groundtruth_content` Markdown.

The full-dataset metric is ROUGE-N F1 after conversion to normalized Markdown. The detailed subset measures edit distance for text, code, formulas, and table content, plus TEDS for table structure. Its aggregate is the source's average of those five metrics.

Code and data are public. The repository states Apache-2.0; dataset use remains subject to the license terms on the dataset page.

## Published comparisons

The full-dataset table includes Dripper, Dripper fallback, magic-html, Readability, Trafilatura, and Resiliparse, plus DeepSeek-V3.2, GPT-5, and Gemini-2.5-Pro as model substitutions within the Dripper pipeline.

These are not results from sending the same URLs to commercial scraping APIs. The detailed-subset table likewise compares MinerU-HTML with extraction libraries; it does not report end-to-end results for providers such as Firecrawl, Tavily, Exa, or Jina.

## Use and limitations

WebMainBench provides a public methodological reference for main-content and Markdown-structure quality. It does not rank live fetching, anti-bot handling, or rendering, and it does not by itself establish that the publisher's methods outperform every commercial product.

The [WebFetch index](../README.md) cites its measurement scope only. Static HTML method ranks are not treated as commercial API ranks, and this project does not introduce a separate judge model to fill in commercial-provider scores.
