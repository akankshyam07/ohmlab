import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SETTINGS_KEY, SettingsProvider, useSettings } from './settings'

function Probe() {
  const { animateFlow, setAnimateFlow } = useSettings()
  return (
    <button type="button" onClick={() => setAnimateFlow(!animateFlow)}>
      {animateFlow ? 'on' : 'off'}
    </button>
  )
}

const mount = () =>
  render(
    <SettingsProvider>
      <Probe />
    </SettingsProvider>,
  )

describe('settings', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to animating flow', () => {
    mount()
    expect(screen.getByRole('button')).toHaveTextContent('on')
  })

  it('persists a change and reads it back on the next mount', () => {
    const { unmount } = mount()
    act(() => screen.getByRole('button').click())
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toEqual({ animateFlow: false })
    unmount()
    mount()
    expect(screen.getByRole('button')).toHaveTextContent('off')
  })

  it('falls back to defaults on corrupted storage', () => {
    localStorage.setItem(SETTINGS_KEY, '{nope')
    mount()
    expect(screen.getByRole('button')).toHaveTextContent('on')
  })

  it('keeps working when storage throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    mount()
    act(() => screen.getByRole('button').click())
    expect(screen.getByRole('button')).toHaveTextContent('off')
    get.mockRestore()
    set.mockRestore()
  })
})
