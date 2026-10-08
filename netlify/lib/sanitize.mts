import sanitizeHtml from 'sanitize-html'

const options: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }) },
  disallowedTagsMode: 'discard',
}

export function sanitizeMessage(html: string) { return sanitizeHtml(html, options) }

export function htmlToText(html: string) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {}, textFilter: (text) => text }).replace(/\s+/g, ' ').trim()
}
