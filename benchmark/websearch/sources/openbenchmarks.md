# Source Notes: OpenBenchmarks Company News

## Source and snapshot

Sources: [leaderboard and methodology](https://openbenchmarks.com/company-news), [code repository linked by the page](https://github.com/openbenchmarks-labs/company-news), and [public dataset subset](https://huggingface.co/datasets/openbenchmarks/OB-News-Websearch).

The source reports 300 questions, 21 endpoints, and a latest measurement date of **2026-10-21**. Recorded source check: **2026-11-06**; the leaderboard returned HTTP 200.

## Methodology

For each question, every endpoint receives the same query once and returns up to 10 results. Answers are extracted only from titles and snippets, without fetching the pages. Reference answers are established by humans in advance. The extraction model is gpt-5.6-terra; the grading model is claude-opus-5, called through Amazon Bedrock.

The code is public, but the public dataset contains only 100 of the 300 questions and omits source URLs. The page states that subset scores cannot be compared with the private 300-question leaderboard. Endpoint count is also not provider count.

## Why the ranking is excluded

At the recorded source check, the page prominently warned:

> Issue · bias found · fix in progress

It also stated that the current results:

> should not be used to compare vendors

Providers were measured at different times. Those tested later had more time to index news, confounding scores with indexing time.

The [WebSearch index](../README.md) therefore records this source without reproducing its scores as a valid ranking. Until the issue is fixed and providers are retested in the same measurement round, its larger endpoint count is not used to fill AA's missing scores. A claim of independence is not treated as verified operational or funding independence.
