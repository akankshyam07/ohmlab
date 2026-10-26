/** A tiny syntax highlighter for lesson code blocks: comments, strings, numbers, keywords (and C preprocessor lines). */

export type TokenKind = 'plain' | 'keyword' | 'string' | 'comment' | 'number' | 'preprocessor'
export interface Token {
  kind: TokenKind
  text: string
}

const CPP_KEYWORDS = new Set(
  (
    'auto bool break byte case char class const continue default delete do double else enum false float for if ' +
    'int long new nullptr private public return short signed sizeof static struct switch this true typedef ' +
    'unsigned void volatile while uint8_t uint16_t uint32_t int8_t int16_t int32_t size_t String ' +
    'HIGH LOW INPUT OUTPUT INPUT_PULLUP LED_BUILTIN'
  ).split(' '),
)

const PYTHON_KEYWORDS = new Set(
  (
    'False None True and as assert async await break class continue def del elif else except finally for from ' +
    'global if import in is lambda nonlocal not or pass raise return try while with yield'
  ).split(' '),
)

// One alternation per language, tried left to right at each position; group names pick the token kind.
// `(?![\s\S])` is the end of the whole source (`$` means end of line under the m flag, needed for `^#`).
const CPP = new RegExp(
  [
    String.raw`(?<comment>\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|(?![\s\S])))`,
    String.raw`(?<string>"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)`,
    String.raw`(?<preprocessor>^[ \t]*#[ \t]*\w+)`,
    String.raw`(?<number>\b(?:0[xX][\da-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)[uUlLfF]*\b)`,
    String.raw`(?<word>\b[A-Za-z_]\w*\b)`,
  ].join('|'),
  'gm',
)

const PYTHON = new RegExp(
  [
    String.raw`(?<comment>#[^\n]*)`,
    String.raw`(?<string>"""[\s\S]*?(?:"""|(?![\s\S]))|'''[\s\S]*?(?:'''|(?![\s\S]))|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)`,
    String.raw`(?<number>\b(?:0[xX][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\b)`,
    String.raw`(?<word>\b[A-Za-z_]\w*\b)`,
  ].join('|'),
  'gm',
)

/** Tokens of the whole source, then split into lines (a block comment or triple-quoted string may span several). */
export function highlight(source: string, language: 'cpp' | 'python' | 'text'): Token[][] {
  const code = source.replace(/\n+$/, '')
  const tokens: Token[] = []
  const push = (kind: TokenKind, text: string) => {
    const last = tokens[tokens.length - 1]
    if (last?.kind === kind && kind === 'plain') last.text += text
    else tokens.push({ kind, text })
  }
  if (language === 'text') push('plain', code)
  else {
    const re = new RegExp(language === 'cpp' ? CPP : PYTHON)
    const keywords = language === 'cpp' ? CPP_KEYWORDS : PYTHON_KEYWORDS
    let at = 0
    for (const m of code.matchAll(re)) {
      if (m[0] === '') continue
      if (m.index > at) push('plain', code.slice(at, m.index))
      const g = m.groups ?? {}
      const kind: TokenKind = g.comment
        ? 'comment'
        : g.string
          ? 'string'
          : g.preprocessor
            ? 'preprocessor'
            : g.number
              ? 'number'
              : keywords.has(m[0])
                ? 'keyword'
                : 'plain'
      push(kind, m[0])
      at = m.index + m[0].length
    }
    if (at < code.length) push('plain', code.slice(at))
  }

  const lines: Token[][] = [[]]
  for (const t of tokens) {
    t.text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ kind: t.kind, text: part })
    })
  }
  return lines
}
