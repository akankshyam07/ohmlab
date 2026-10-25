import { Fragment } from 'react'

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g

/** Renders **bold**, *emphasis* and `code`. Everything else is plain text (no HTML injection). */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(TOKEN).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
          return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
          return <code key={i}>{part.slice(1, -1)}</code>
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
          return <em key={i}>{part.slice(1, -1)}</em>
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}
