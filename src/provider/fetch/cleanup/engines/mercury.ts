import Mercury from "@jocmp/mercury-parser"

export async function run(html: string, url: string) {
  const result = await Mercury.parse(url, { html })
  return { html: typeof result?.content === "string" ? result.content : "" }
}
