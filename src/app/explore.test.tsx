import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PartInfo, Topic } from '../content/types'
import { PartPage, PartsPage, groupParts } from './parts'
import { TopicPage, TopicsPage } from './topics'

const fx = vi.hoisted(() => {
  const part = (id: string, name: string, category: string, topicIds: string[], extra = {}) =>
    ({
      id,
      name,
      category,
      summary: `${name} summary`,
      availability: { source: 'kit' },
      features: [],
      howToConnect: ['Plug it in.'],
      mistakes: [],
      topicIds,
      ...extra,
    }) as unknown as PartInfo
  const parts = [
    part('esp32-devkit', 'ESP32 DevKit', 'board', ['esp32-wireless'], {
      availability: { source: 'buy', price: '$6' },
      features: [
        { anchor: 'antenna', title: 'PCB antenna', detail: 'Keep metal away.' },
        { anchor: 'usb', title: 'USB port', detail: 'Power and upload.' },
        { anchor: 'en-button', title: 'EN button', detail: 'Resets the chip.' },
      ],
      pins: [{ name: '3V3', detail: '3.3 V out' }],
      mistakes: ['Feeding 5 V into a GPIO.'],
      related: ['arduino-uno'],
      lessonIds: ['first-led'],
    }),
    part('arduino-uno', 'Arduino Uno', 'board', ['arduino', 'basics']),
    part('led', 'LED', 'output', ['basics']),
    part('resistor', 'Resistor', 'passive', ['basics']),
  ]
  const topics: Topic[] = [
    {
      id: 'basics',
      title: 'Basics',
      summary: 'Volts.',
      lessonIds: ['first-led'],
      partIds: ['led', 'resistor'],
      days: [1, 2, 3],
    },
    {
      id: 'esp32-wireless',
      title: 'ESP32 and wireless',
      summary: 'WiFi.',
      lessonIds: [],
      partIds: ['esp32-devkit'],
      days: [71, 72],
    },
  ] as Topic[]
  return { parts, topics }
})

vi.mock('../content/parts', () => ({
  parts: fx.parts,
  getPart: (id: string) => fx.parts.find((p) => p.id === id),
}))
vi.mock('../content/topics', () => ({ topics: fx.topics }))
vi.mock('../content', () => {
  const lesson = { id: 'first-led', day: 1, title: 'First LED' }
  return {
    lessons: [lesson],
    getLesson: (id: string) => (id === lesson.id ? lesson : undefined),
    phases: [
      {
        n: 1,
        days: [
          { day: 1, title: 'First LED', lessonId: 'first-led' },
          { day: 2, title: 'Ohm’s law' },
          { day: 3, title: 'Breadboards' },
        ],
      },
    ],
  }
})
vi.mock('../progress/store', () => ({
  useProgress: () => ({
    progress: { lessons: {} },
    mastery: () => 0,
    isComplete: () => false,
  }),
}))
// The 3D model: shows which anchor it is zoomed to, and offers its hotspots as buttons.
vi.mock('../viz/iso/PartViewer', () => ({
  PartViewer: (p: {
    ariaLabel: string
    activeAnchor?: string
    onAnchor?: (a: string) => void
    anchorLabels?: Record<string, string>
  }) => (
    <div role="img" aria-label={p.ariaLabel} data-anchor={p.activeAnchor ?? ''}>
      {p.onAnchor &&
        Object.entries(p.anchorLabels ?? {}).map(([a, label]) => (
          <button key={a} type="button" onClick={() => p.onAnchor?.(a)}>
            Hotspot {label}
          </button>
        ))}
    </div>
  ),
}))

beforeEach(() => {
  window.history.replaceState(null, '', '#/')
  Element.prototype.scrollIntoView = vi.fn()
})

describe('Parts index', () => {
  it('groups by category and filters by topic', () => {
    render(<PartsPage />)
    expect(screen.getByRole('heading', { level: 2, name: 'Boards' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'LED' })).toHaveAttribute('href', '#/parts/led')
    expect(screen.getByText('Buy ~$6')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'ESP32 and wireless' }))
    expect(screen.getByRole('link', { name: 'ESP32 DevKit' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'LED' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Passives' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'All parts' }))
    expect(screen.getByRole('link', { name: 'LED' })).toBeInTheDocument()
  })

  it('groupParts keeps the category order and drops empty groups', () => {
    expect(groupParts(fx.parts, 'basics').map((g) => g.category)).toEqual(['board', 'passive', 'output'])
    expect(groupParts(fx.parts, 'nothing')).toEqual([])
  })
})

describe('Part page', () => {
  it('a deep-linked anchor selects its feature and zooms the model there', () => {
    render(<PartPage id="esp32-devkit" anchor="antenna" />)
    const model = screen.getByRole('img', { name: '3D model of the ESP32 DevKit' })
    expect(model).toHaveAttribute('data-anchor', 'antenna')
    expect(screen.getByRole('button', { name: /^PCB antenna/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('features and hotspots stay in sync, and the address follows', () => {
    render(<PartPage id="esp32-devkit" />)
    const model = screen.getByRole('img', { name: '3D model of the ESP32 DevKit' })
    expect(model).toHaveAttribute('data-anchor', '')

    fireEvent.click(screen.getByRole('button', { name: /^USB port/ }))
    expect(model).toHaveAttribute('data-anchor', 'usb')
    expect(window.location.hash).toBe('#/parts/esp32-devkit/usb')

    fireEvent.click(screen.getByRole('button', { name: 'Hotspot EN button' }))
    expect(model).toHaveAttribute('data-anchor', 'en-button')
    expect(screen.getByRole('button', { name: /^EN button/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^USB port/ })).toHaveAttribute('aria-pressed', 'false')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Whole part' }))
    expect(model).toHaveAttribute('data-anchor', '')
    expect(window.location.hash).toBe('#/parts/esp32-devkit')
  })

  it('shows pins, wiring steps, mistakes, lessons and related parts; unknown anchors and parts are handled', () => {
    const { unmount } = render(<PartPage id="esp32-devkit" anchor="nope" />)
    expect(screen.getByRole('img', { name: /3D model/ })).toHaveAttribute('data-anchor', '')
    expect(screen.getByRole('table')).toHaveTextContent('3V3')
    expect(screen.getByRole('heading', { name: 'How to connect it in real life' })).toBeInTheDocument()
    expect(screen.getByText('Feeding 5 V into a GPIO.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Day 1 First LED/ })).toHaveAttribute('href', '#/lesson/first-led')
    expect(screen.getByRole('link', { name: /Arduino Uno/ })).toHaveAttribute('href', '#/parts/arduino-uno')
    unmount()
    render(<PartPage id="flux-capacitor" />)
    expect(screen.getByRole('heading', { name: 'Nothing is connected here' })).toBeInTheDocument()
  })
})

describe('Topics', () => {
  it('index cards link to each topic with lesson and part counts', () => {
    render(<TopicsPage />)
    const basics = screen.getByRole('link', { name: 'Basics' })
    expect(basics).toHaveAttribute('href', '#/topics/basics')
    expect(basics.closest('article')).toHaveTextContent('1 lesson ready')
    expect(screen.getByRole('link', { name: 'ESP32 and wireless' }).closest('article')).toHaveTextContent('Coming soon')
  })

  it('a topic lists its days in order: live lessons link, the rest are "Coming soon" without links', () => {
    render(<TopicPage id="basics" />)
    const list = screen.getByRole('heading', { name: 'Lessons, in order' }).nextElementSibling as HTMLElement
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(within(items[0]).getByRole('link', { name: 'Day 1: First LED' })).toHaveAttribute(
      'href',
      '#/lesson/first-led',
    )
    expect(items[1]).toHaveTextContent('Day 2Ohm’s lawComing soon')
    expect(within(items[1]).queryByRole('link')).toBeNull()
    expect(screen.getByRole('link', { name: /Resistor/ })).toHaveAttribute('href', '#/parts/resistor')
  })
})
