declare module "@jocmp/mercury-parser" {
  export interface MercuryResult {
    title?: string | null
    content?: string | null
    dek?: string | null
    excerpt?: string | null
    author?: string | null
    date_published?: string | null
    lead_image_url?: string | null
    word_count?: number | null
    [key: string]: unknown
  }

  const Mercury: {
    parse(url: string, init?: { html?: string } & Record<string, unknown>): Promise<MercuryResult>
  }

  export default Mercury
}
