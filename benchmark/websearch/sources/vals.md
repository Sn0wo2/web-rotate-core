# Source Notes: Vals Web Search Index

## Source and snapshot

Vals AI is a third-party commercial evaluation organization. Its [leaderboard and methodology](https://www.vals.ai/benchmarks/web_search) report an update date of **2026-10-21**.

Recorded source check: **2026-11-06**; the page returned HTTP 200.

## Evaluation scope

The benchmark compares 9 **model-search tool combinations** using Exa, Keenable, and model providers' Native search. A common agent harness is used, but scores from different models do not isolate the causal effect of changing only the search tool.

Finance uses FAB v2: 450 questions across 9 task categories, with category-balanced partial credit. Failure on a critical condition gives the question a zero score. Law uses 208 expert-written questions, with the primary metric requiring all grading conditions to pass.

Domain-specific search tools from the original tasks, such as SEC EDGAR and CourtListener, are removed, leaving only general web search. Legal grading uses GPT-5.4; financial grading uses a three-model panel of GPT-5.4, Gemini-3.1-Pro, and Claude Sonnet 4.6.

## Published combination ranking

Overall scores and order are taken directly from the source. They are not combined with AA's index.

| Source rank | Model            | Tool     | Overall | Cost per task | Time per task |
| ----------- | ---------------- | -------- | ------- | ------------- | ------------- |
| 1           | GPT-5.6 Sol      | Keenable | 49.08%  | $8.84         | 6m35s         |
| 2           | Claude Fable 5   | Exa      | 48.45%  | $3.48         | 5m52s         |
| 3           | Claude Fable 5   | Native   | 46.94%  | $4.37         | 12m22s        |
| 4           | GPT-5.6 Sol      | Exa      | 45.24%  | $18.97        | 8m51s         |
| 5           | GPT-5.6 Sol      | Native   | 43.58%  | $0.95         | 5m29s         |
| 6           | Gemini 3.5 Flash | Exa      | 41.36%  | $1.18         | 3m17s         |
| 7           | Grok 4.5         | Exa      | 38.75%  | $0.58         | 100.93s       |
| 8           | Gemini 3.5 Flash | Native   | 37.04%  | $0.50         | 4m10s         |
| 9           | Grok 4.5         | Native   | 35.54%  | $0.99         | 2m17s         |

Costs include both model and tool use per task. They are not prices for individual search API calls.

## Use and limitations

The [WebSearch index](../README.md) uses Vals as a finance and law supplement, not a replacement for a general-search benchmark. Coverage includes only 3 tool categories, and Keenable appears only with GPT-5.6 Sol. These results do not establish that Keenable ranks first in general search across models.

Native means each model provider's built-in search, not this project's `native` implementation. Domains, grading rules, models, and cost definitions differ from AA's. Scores are not averaged across the two benchmarks, and ranks are not combined through weighting.
