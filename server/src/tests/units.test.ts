import { describe, expect, it } from 'vitest'
import {
  canDispatch,
  generateUnitId,
  monthCode,
  timeSlotCode,
  unitIdPrefix,
  isReadyForReworkDispatch,
  isReworkUnit,
  latestGateEntry,
  normalizeProductCode,
  partsForType,
  unitAgeDays,
} from '../domain/units.js'

const parts = { productCode: '4011571', variant: 'A', lineCode: 'K' }

// 4011571 A 26 A K L VP2G — product code, variant, year, month, line, time slot, serial
describe('generateUnitId', () => {
  it('lays out the 17 characters exactly as the VOLTAS spec', () => {
    const at = new Date(2026, 0, 15, 11, 30) // January, 11 AM
    const id = generateUnitId(parts, at, 'VP2G')
    expect(id).toBe('4011571A26AKCVP2G')
    expect(id).toHaveLength(17)
    expect(id.slice(0, 7)).toBe('4011571') // product code
    expect(id[7]).toBe('A') // variant
    expect(id.slice(8, 10)).toBe('26') // year
    expect(id[10]).toBe('A') // month — January
    expect(id[11]).toBe('K') // manufacturing line
    expect(id[12]).toBe('C') // 11 AM slot
    expect(id.slice(13)).toBe('VP2G') // 4-char random serial
  })

  it('encodes every month as A through L', () => {
    expect(monthCode(new Date(2026, 0, 1))).toBe('A')
    expect(monthCode(new Date(2026, 7, 1))).toBe('H')
    expect(monthCode(new Date(2026, 11, 1))).toBe('L')
  })

  it('steps the time slot one letter per hour from the 9 AM shift start', () => {
    expect(timeSlotCode(new Date(2026, 0, 1, 9, 5))).toBe('A')
    expect(timeSlotCode(new Date(2026, 0, 1, 10, 59))).toBe('B')
    expect(timeSlotCode(new Date(2026, 0, 1, 17, 0))).toBe('I')
    expect(timeSlotCode(new Date(2026, 0, 1, 8, 0))).toBe('X') // before the shift, wraps
  })

  it('pads a short product code to seven characters', () => {
    const id = generateUnitId({ ...parts, productCode: '40115' }, new Date(2026, 0, 5, 9), 'ZZZZ')
    expect(id.slice(0, 7)).toBe('40115XX')
  })

  it('strips separators the scanner may inject', () => {
    expect(normalizeProductCode('40-11 571a/')).toBe('4011571')
  })

  it('previews everything except the random tail', () => {
    const at = new Date(2026, 0, 15, 11, 30)
    expect(unitIdPrefix(parts, at)).toBe('4011571A26AKC')
    expect(generateUnitId(parts, at, 'VP2G').startsWith(unitIdPrefix(parts, at))).toBe(true)
  })
})

describe('unit types', () => {
  it('drops the compressor for an indoor assembly', () => {
    expect(partsForType('indoor')).toEqual(['motor', 'controller', 'heatExchanger'])
    expect(partsForType('outdoor')).toContain('compressor')
  })
})

describe('gate / rework state machine', () => {
  const withGate = (...statuses: { status: string; reworkDone?: boolean }[]) => ({ gateLog: statuses as never })

  it('treats a unit that never reached the Gate as new production', () => {
    const unit = { gateLog: [] }
    expect(isReworkUnit(unit)).toBe(false)
    expect(canDispatch(unit)).toBe(true)
  })

  it('blocks dispatch while Quality has not decided', () => {
    const unit = withGate({ status: 'pending' })
    expect(isReworkUnit(unit)).toBe(true)
    expect(canDispatch(unit)).toBe(false)
  })

  it('blocks dispatch after a rejection', () => {
    expect(canDispatch(withGate({ status: 'rejected' }))).toBe(false)
  })

  it('still blocks dispatch once issued but before Production finishes the rework', () => {
    const unit = withGate({ status: 'issued' })
    expect(isReadyForReworkDispatch(unit)).toBe(false)
    expect(canDispatch(unit)).toBe(false)
  })

  it('allows dispatch only when issued and reworked', () => {
    const unit = withGate({ status: 'issued', reworkDone: true })
    expect(isReadyForReworkDispatch(unit)).toBe(true)
    expect(canDispatch(unit)).toBe(true)
  })

  it('judges a re-returned unit on its newest gate entry', () => {
    const unit = withGate({ status: 'issued', reworkDone: true }, { status: 'pending' })
    expect(latestGateEntry(unit)?.status).toBe('pending')
    expect(canDispatch(unit)).toBe(false)
  })
})

describe('unitAgeDays', () => {
  it('measures age from the assembly date', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    expect(unitAgeDays(tenDaysAgo)).toBe(10)
  })

  it('returns null when the date is missing or unparseable', () => {
    expect(unitAgeDays(null)).toBeNull()
    expect(unitAgeDays('not a date')).toBeNull()
  })
})
