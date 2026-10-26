import { describe, expect, it } from 'vitest'
import { highlight } from './highlight'

const kinds = (line: ReturnType<typeof highlight>[number]) => line.map((t) => `${t.kind}:${t.text}`)

describe('highlight', () => {
  it('marks C++ keywords, strings, numbers, comments and #include', () => {
    const lines = highlight('#include <WiFi.h>\nconst int LED = 23; // pin\nSerial.println("hi");\n', 'cpp')
    expect(lines).toHaveLength(3)
    expect(kinds(lines[0])[0]).toBe('preprocessor:#include')
    expect(kinds(lines[1])).toEqual([
      'keyword:const',
      'plain: ',
      'keyword:int',
      'plain: LED = ',
      'number:23',
      'plain:; ',
      'comment:// pin',
    ])
    expect(kinds(lines[2])).toContain('string:"hi"')
  })

  it('keeps a block comment across lines, and never colours inside strings', () => {
    const lines = highlight('/* a\nb */ int x = "// not a comment";', 'cpp')
    expect(kinds(lines[0])).toEqual(['comment:/* a'])
    expect(kinds(lines[1])).toEqual(['comment:b */', 'plain: ', 'keyword:int', 'plain: x = ', 'string:"// not a comment"', 'plain:;'])
  })

  it('handles Python and plain text', () => {
    expect(kinds(highlight('def f(): return 1  # one', 'python')[0])).toEqual([
      'keyword:def',
      'plain: f(): ',
      'keyword:return',
      'plain: ',
      'number:1',
      'plain:  ',
      'comment:# one',
    ])
    expect(highlight('a "b"\n\nc', 'text').map(kinds)).toEqual([['plain:a "b"'], [], ['plain:c']])
  })
})
