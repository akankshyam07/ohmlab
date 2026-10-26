import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProblem, isClientKey, readConfig, toProblem } from './client'

const jwt = (payload: object) =>
  ['eyJhbGciOiJIUzI1NiJ9', btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'), 'sig'].join('.')

describe('config', () => {
  afterEach(() => vi.restoreAllMocks())

  it('accepts a publishable key or a legacy anon JWT', () => {
    expect(isClientKey('sb_publishable_abc123')).toBe(true)
    expect(isClientKey(jwt({ role: 'anon', ref: 'x' }))).toBe(true)
  })

  it('refuses secret and service_role keys', () => {
    expect(isClientKey('sb_secret_abc123')).toBe(false)
    expect(isClientKey(jwt({ role: 'service_role' }))).toBe(false)
    expect(isClientKey('garbage')).toBe(false)
  })

  it('is off without env, and off (with a console error) when env is wrong', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(readConfig({})).toBeNull()
    expect(readConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' })).toBeNull()
    expect(error).not.toHaveBeenCalled()
    expect(readConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_1' })).toBeNull()
    expect(readConfig({ VITE_SUPABASE_URL: 'x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1' })).toBeNull()
    expect(error).toHaveBeenCalledTimes(2)
    expect(
      readConfig({ VITE_SUPABASE_URL: ' https://x.supabase.co ', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1' }),
    ).toEqual({ url: 'https://x.supabase.co', key: 'sb_publishable_1' })
  })
})

describe('toProblem', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each([
    [{ name: 'AuthRetryableFetchError', status: 0 }, 'offline'],
    [{ message: 'TypeError: Failed to fetch', code: '' }, 'offline', 0],
    [{ status: 429, code: 'over_request_rate_limit' }, 'rate-limit'],
    [{ status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' }, 'bad-code'],
    [{ status: 400, code: 'validation_failed' }, 'bad-email'],
    [{ status: 400, code: 'email_address_not_authorized' }, 'unavailable'],
    [{ status: 500, code: 'unexpected_failure' }, 'unknown'],
  ])('%o → %s', (error, kind, status?: number) => {
    expect(toProblem(error, status).kind).toBe(kind)
  })

  it('reports offline whenever the browser is offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(toProblem({ status: 500 }).kind).toBe('offline')
  })

  it('marks offline problems for retry and newer data as fatal', () => {
    expect(new AuthProblem('offline')).toMatchObject({ offline: true, fatal: false })
    expect(new AuthProblem('newer-data')).toMatchObject({ offline: false, fatal: true })
  })
})
