import DOMPurify from 'dompurify'

/** Plain-text chat lines: strip any HTML/script */
export function sanitizeUserText(text: string): string {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], KEEP_CONTENT: true })
}
