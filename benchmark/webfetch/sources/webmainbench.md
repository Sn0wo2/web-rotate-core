# 来源整理：WebMainBench

## 原始来源与时间

- 发布者：OpenDataLab；基准服务于同团队 MinerU-HTML／Dripper 研究，需注意方法作者与基准发布者的关联。
- [原始仓库、方法及结果](https://github.com/opendatalab/WebMainBench)
- [数据集](https://huggingface.co/datasets/opendatalab/WebMainBench)
- [论文：Dripper: Token-Efficient Main HTML Extraction with a Lightweight LM](https://arxiv.org/abs/2511.23119)
- 本次核验：**2026-11-06**，原始 README HTTP 200。来源 README 没有给出所有结果统一的测量日期，不用仓库更新时间替代。

## 数据与指标

- 全集：7,809 个网页、5,434 个域名、46 种语言；来源说明 HTML 标签级标注经标注员、复核员、高级检查员三轮人工处理。
- 精细子集：545 页，人工校准的 `groundtruth_content` Markdown。
- 全集指标：将内容转为规范化 Markdown 后计算 ROUGE-N F1。
- 子集指标：文本、代码、公式、表格内容的编辑距离，以及表格结构 TEDS；综合值按来源的五项指标平均。
- 代码及数据公开；仓库标示 Apache-2.0，数据使用仍以数据集页面的授权说明为准。

## 原榜比较对象

全集表列出 Dripper、Dripper fallback、magic-html、Readability、Trafilatura、Resiliparse，以及在 Dripper 管线中替换模型的 DeepSeek-V3.2、GPT-5、Gemini-2.5-Pro。

这不是把同一批 URL 交给不同商业抓取 API 的榜单。精细子集表同样比较 MinerU-HTML 与抽取库，不包含 Firecrawl、Tavily、Exa、Jina 等供应商完整链路成绩。

## 采用边界

可作为正文及 Markdown 结构质量的公开方法参考，但不提供实时抓取、反爬、渲染能力排名，也不自动证明其发布方方法优于所有商业产品。

[最终索引](../README.md)只引用其测量范围，不把静态 HTML 方法名次当作商业 API 名次，也不在本项目另设裁判模型给商业供应商补分。
