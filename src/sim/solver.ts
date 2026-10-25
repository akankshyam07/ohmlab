// DC operating-point solver: Modified Nodal Analysis + Newton–Raphson for diodes/LEDs.
// See docs/SIMULATION_SPEC.md for the models, parameters and accuracy claims.
import type {
  Circuit,
  Component,
  ComponentResult,
  ComponentStatus,
  LedColor,
  NodeId,
  SolveResult,
} from './types'

/** Thermal voltage kT/q at ~300 K. */
const VT = 0.02585
/** Minimum conductance across every junction and from every node to ground. */
const GMIN = 1e-12
/** Stand-in for 0 Ω resistors and closed switches. */
const R_SHORT = 1e-3
const DEFAULT_RATED_WATTS = 0.25
const SHORT_CIRCUIT_AMPS = 5
const MAX_ITERATIONS = 200
const SOURCE_STEPS = 20
const V_TOL = 1e-6
/** Above this exp() argument the junction is continued linearly so it can't overflow. */
const MAX_EXP_ARG = 100

interface JunctionModel {
  is: number
  n: number
  rs: number
}

const LED_RS = 4
const LED_REF_AMPS = 0.02
/** LED status thresholds, matching the lessons: 20 mA is the safe continuous limit. */
const LED_ON_AMPS = 50e-6
const LED_MAX_AMPS = 0.02
const LED_BURNT_AMPS = 0.06
/** Rated reverse voltages: typical 5 mm LED, and a 1N4148-class small-signal diode. */
const LED_RATED_REVERSE_VOLTS = 5
const DIODE_RATED_REVERSE_VOLTS = 75

/** Solve the Shockley equation for Is so that Vf(20 mA) = vf20, including the Rs drop. */
function ledModel(vf20: number, n: number): JunctionModel {
  const vj = vf20 - LED_REF_AMPS * LED_RS
  return { is: LED_REF_AMPS / Math.expm1(vj / (n * VT)), n, rs: LED_RS }
}

const LED_MODELS: Record<LedColor, JunctionModel> = {
  red: ledModel(2.0, 1.7),
  yellow: ledModel(2.1, 1.7),
  green: ledModel(2.2, 1.7),
  blue: ledModel(3.1, 2.0),
  white: ledModel(3.1, 2.0),
}

/** 1N4148 SPICE parameters (Is, N), with Rs rounded to 1 Ω. */
const DIODE_MODEL: JunctionModel = { is: 2.52e-9, n: 1.752, rs: 1 }

interface Junction {
  anode: number
  internal: number
  cathode: number
  is: number
  nvt: number
  vcrit: number
}

interface Conductance {
  a: number
  b: number
  g: number
}

interface Source {
  pos: number
  neg: number
  row: number
  volts: number
}

interface System {
  size: number
  nodeCount: number
  nodeIndex: Map<NodeId, number>
  conductances: Conductance[]
  sources: Source[]
  junctions: Junction[]
  /** Per component: index of the internal node (diode/LED), branch row (vsource), or -1. */
  extra: number[]
}

const GROUND = -1

export interface SolveOptions {
  /** Newton iteration cap per attempt (tests lower it to exercise source stepping). */
  maxIterations?: number
}

export function solveDC(circuit: Circuit, options: SolveOptions = {}): SolveResult {
  try {
    const invalid = validate(circuit)
    if (invalid) return failure(invalid, circuit)

    const sys = buildSystem(circuit)
    const maxIterations = options.maxIterations ?? MAX_ITERATIONS
    let x = new Float64Array(sys.size)
    let vj = new Float64Array(sys.junctions.length)

    let solved = newton(sys, x, vj, 1, maxIterations)
    if (!solved) {
      // Source stepping: ramp every source from 0 to 100 %, warm-starting each step.
      x = new Float64Array(sys.size)
      vj = new Float64Array(sys.junctions.length)
      for (let step = 1; step <= SOURCE_STEPS; step++) {
        solved = newton(sys, x, vj, step / SOURCE_STEPS, maxIterations)
        if (!solved) break
      }
    }
    if (!solved) {
      return failure(
        "The simulator couldn't settle on an answer for this circuit. Try changing a part's value; if it keeps happening, it's a bug in Ohmlab.",
        circuit,
      )
    }
    return buildResult(circuit, sys, x)
  } catch (err) {
    return failure(
      `Something went wrong inside the simulator (${err instanceof Error ? err.message : String(err)}).`,
      circuit,
    )
  }
}

// ---------------------------------------------------------------------------
// Validation

const NODE_FIELDS: Record<Component['kind'], string[]> = {
  vsource: ['pos', 'neg'],
  resistor: ['a', 'b'],
  led: ['anode', 'cathode'],
  diode: ['anode', 'cathode'],
  switch: ['a', 'b'],
}

function validate(circuit: Circuit): string | null {
  if (!circuit || typeof circuit !== 'object' || !Array.isArray(circuit.components)) {
    return "This circuit couldn't be read."
  }
  if (circuit.components.length === 0) return 'There are no parts in this circuit yet.'
  if (typeof circuit.ground !== 'string' || circuit.ground === '') {
    return 'This circuit has no ground (the 0 V reference point).'
  }

  const ids = new Set<string>()
  let groundUsed = false
  for (const [i, c] of circuit.components.entries()) {
    if (!c || typeof c !== 'object') return `Part number ${i + 1} couldn't be read.`
    if (typeof c.id !== 'string' || c.id === '') return `Part number ${i + 1} has no name.`
    if (ids.has(c.id)) return `Two parts are both called ${c.id}; every part needs its own name.`
    ids.add(c.id)
    if (!Object.hasOwn(NODE_FIELDS, c.kind)) {
      return `${c.id} is a kind of part ("${String(c.kind)}") that the simulator doesn't know.`
    }
    for (const f of NODE_FIELDS[c.kind]) {
      const node = (c as unknown as Record<string, unknown>)[f]
      if (typeof node !== 'string' || node === '') return `${c.id} has a leg that isn't connected anywhere.`
      if (node === circuit.ground) groundUsed = true
    }
    switch (c.kind) {
      case 'vsource':
        if (!Number.isFinite(c.volts) || c.volts < 0) {
          return `${c.id}'s voltage must be a number of 0 V or more (flip the source around for the opposite polarity).`
        }
        break
      case 'resistor':
        if (!Number.isFinite(c.ohms) || c.ohms < 0) return `${c.id}'s resistance must be a number of 0 Ω or more.`
        if (c.ratedWatts !== undefined && !(Number.isFinite(c.ratedWatts) && c.ratedWatts > 0)) {
          return `${c.id}'s power rating must be a number above 0 W.`
        }
        break
      case 'led':
        if (!Object.hasOwn(LED_MODELS, c.color)) return `${c.id} has an LED colour ("${String(c.color)}") the simulator doesn't know.`
        break
      case 'switch':
        if (typeof c.closed !== 'boolean') return `${c.id} must be either open or closed.`
        break
    }
  }
  if (!groundUsed) {
    return `Nothing is connected to ground (${circuit.ground}), so there is no 0 V reference to measure voltages from.`
  }

  // A loop made only of voltage sources has no unique solution (and is a dead short in real life).
  const parent = new Map<NodeId, NodeId>()
  const find = (n: NodeId): NodeId => {
    while (parent.has(n)) n = parent.get(n)!
    return n
  }
  for (const c of circuit.components) {
    if (c.kind !== 'vsource') continue
    if (c.pos === c.neg) return `Short circuit: ${c.id}'s + and − are connected to the same point.`
    const [p, n] = [find(c.pos), find(c.neg)]
    if (p === n) {
      return `${c.id} is wired straight across another power source with no parts in between. That is a short circuit; add a resistor.`
    }
    parent.set(p, n)
  }
  return null
}

// ---------------------------------------------------------------------------
// MNA system

function buildSystem(circuit: Circuit): System {
  const nodeIndex = new Map<NodeId, number>([[circuit.ground, GROUND]])
  let next = 0
  const node = (id: NodeId) => {
    let i = nodeIndex.get(id)
    if (i === undefined) nodeIndex.set(id, (i = next++))
    return i
  }
  for (const c of circuit.components) for (const f of NODE_FIELDS[c.kind]) node((c as unknown as Record<string, NodeId>)[f])

  const conductances: Conductance[] = []
  const junctions: Junction[] = []
  const extra: number[] = []
  for (const c of circuit.components) {
    extra.push(-1)
    if (c.kind === 'resistor') {
      conductances.push({ a: node(c.a), b: node(c.b), g: 1 / Math.max(c.ohms, R_SHORT) })
    } else if (c.kind === 'switch') {
      if (c.closed) conductances.push({ a: node(c.a), b: node(c.b), g: 1 / R_SHORT })
    } else if (c.kind === 'led' || c.kind === 'diode') {
      const model = c.kind === 'led' ? LED_MODELS[c.color] : DIODE_MODEL
      const internal = next++
      extra[extra.length - 1] = internal
      const anode = node(c.anode)
      conductances.push({ a: anode, b: internal, g: 1 / model.rs })
      const nvt = model.n * VT
      junctions.push({
        anode,
        internal,
        cathode: node(c.cathode),
        is: model.is,
        nvt,
        vcrit: nvt * Math.log(nvt / (Math.SQRT2 * model.is)),
      })
    }
  }

  const nodeCount = next
  const sources: Source[] = []
  for (const [i, c] of circuit.components.entries()) {
    if (c.kind !== 'vsource') continue
    extra[i] = next
    sources.push({ pos: node(c.pos), neg: node(c.neg), row: next++, volts: c.volts })
  }
  return { size: next, nodeCount, nodeIndex, conductances, sources, junctions, extra }
}

/** Shockley current and its derivative, continued linearly past MAX_EXP_ARG. */
function junctionIV(j: Junction, v: number): [number, number] {
  const arg = v / j.nvt
  if (arg > MAX_EXP_ARG) {
    const e = Math.exp(MAX_EXP_ARG)
    return [j.is * (e * (1 + arg - MAX_EXP_ARG) - 1), (j.is * e) / j.nvt]
  }
  const e = Math.exp(arg)
  return [j.is * (e - 1), (j.is * e) / j.nvt]
}

/** SPICE3 pnjlim: stop a forward junction voltage from jumping so far that exp() runs away. */
function pnjlim(vnew: number, vold: number, nvt: number, vcrit: number): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * nvt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / nvt
      return arg > 0 ? vold + nvt * Math.log(arg) : vcrit
    }
    return nvt * Math.log(vnew / nvt)
  }
  return vnew
}

/**
 * Newton–Raphson at the given source scale. Updates x and vj in place.
 * Returns true on convergence.
 */
function newton(sys: System, x: Float64Array, vj: Float64Array, scale: number, maxIterations: number): boolean {
  const n = sys.size
  const A = new Float64Array(n * n)
  const b = new Float64Array(n)
  const add = (r: number, c: number, v: number) => {
    if (r !== GROUND && c !== GROUND) A[r * n + c] += v
  }
  const addB = (r: number, v: number) => {
    if (r !== GROUND) b[r] += v
  }
  const stampG = (p: number, q: number, g: number) => {
    add(p, p, g)
    add(q, q, g)
    add(p, q, -g)
    add(q, p, -g)
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    A.fill(0)
    b.fill(0)
    for (let i = 0; i < sys.nodeCount; i++) A[i * n + i] += GMIN
    for (const c of sys.conductances) stampG(c.a, c.b, c.g)
    for (const s of sys.sources) {
      add(s.pos, s.row, 1)
      add(s.neg, s.row, -1)
      add(s.row, s.pos, 1)
      add(s.row, s.neg, -1)
      b[s.row] = s.volts * scale
    }
    const linearised: [number, number][] = []
    for (const [k, j] of sys.junctions.entries()) {
      const [id, gd] = junctionIV(j, vj[k])
      linearised.push([id, gd])
      stampG(j.internal, j.cathode, gd + GMIN)
      const ieq = id - gd * vj[k]
      addB(j.internal, -ieq)
      addB(j.cathode, ieq)
    }

    const xNew = solveLinear(A, b, n)
    if (!xNew) throw new Error('the circuit equations have no unique solution')
    if (!xNew.every(Number.isFinite)) return false

    let maxDelta = 0
    for (let i = 0; i < sys.nodeCount; i++) maxDelta = Math.max(maxDelta, Math.abs(xNew[i] - x[i]))
    let settled = true
    for (const [k, j] of sys.junctions.entries()) {
      const vRaw = at(xNew, j.internal) - at(xNew, j.cathode)
      const vLim = pnjlim(vRaw, vj[k], j.nvt, j.vcrit)
      const [idOld, gdOld] = linearised[k]
      const [idNew] = junctionIV(j, vRaw)
      const predicted = idOld + gdOld * (vRaw - vj[k])
      if (vLim !== vRaw || Math.abs(idNew - predicted) > 1e-12 + 1e-6 * Math.abs(idNew)) settled = false
      vj[k] = vLim
    }
    for (const s of sys.sources) {
      if (Math.abs(xNew[s.row] - x[s.row]) > 1e-12 + 1e-6 * Math.abs(xNew[s.row])) settled = false
    }
    x.set(xNew)
    if (sys.junctions.length === 0) return true
    if (settled && maxDelta < V_TOL) return true
  }
  return false
}

function at(x: Float64Array, i: number): number {
  return i === GROUND ? 0 : x[i]
}

/** Dense Gaussian elimination with partial pivoting. Returns null if singular. */
function solveLinear(A: Float64Array, b: Float64Array, n: number): Float64Array | null {
  for (let col = 0; col < n; col++) {
    let pivotRow = col
    let best = Math.abs(A[col * n + col])
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r * n + col])
      if (v > best) {
        best = v
        pivotRow = r
      }
    }
    if (!(best > 1e-30)) return null
    if (pivotRow !== col) {
      for (let c = col; c < n; c++) {
        const t = A[col * n + c]
        A[col * n + c] = A[pivotRow * n + c]
        A[pivotRow * n + c] = t
      }
      const t = b[col]
      b[col] = b[pivotRow]
      b[pivotRow] = t
    }
    const pivot = A[col * n + col]
    for (let r = col + 1; r < n; r++) {
      const f = A[r * n + col] / pivot
      if (f === 0) continue
      for (let c = col; c < n; c++) A[r * n + c] -= f * A[col * n + c]
      b[r] -= f * b[col]
    }
  }
  const x = new Float64Array(n)
  for (let r = n - 1; r >= 0; r--) {
    let sum = b[r]
    for (let c = r + 1; c < n; c++) sum -= A[r * n + c] * x[c]
    x[r] = sum / A[r * n + r]
  }
  return x
}

// ---------------------------------------------------------------------------
// Results

function buildResult(circuit: Circuit, sys: System, x: Float64Array): SolveResult {
  const v = (id: NodeId) => at(x, sys.nodeIndex.get(id)!)
  const grounded = nodesConnectedToGround(circuit)
  const nodeVoltages: Record<NodeId, number> = {}
  for (const id of sys.nodeIndex.keys()) if (grounded.has(id)) nodeVoltages[id] = v(id)

  const components: Record<string, ComponentResult> = {}
  let error: string | undefined
  for (const [i, c] of circuit.components.entries()) {
    switch (c.kind) {
      case 'resistor': {
        const voltage = v(c.a) - v(c.b)
        const current = voltage / Math.max(c.ohms, R_SHORT)
        const power = voltage * current
        const rated = c.ratedWatts ?? DEFAULT_RATED_WATTS
        const status: ComponentStatus =
          power > 2 * rated ? 'burnt' : power > rated ? 'overpower' : Math.abs(current) < 1e-6 ? 'off' : 'ok'
        components[c.id] = { current, voltage, power, status }
        break
      }
      case 'switch': {
        const voltage = v(c.a) - v(c.b)
        const current = c.closed ? voltage / R_SHORT : 0
        components[c.id] = { current, voltage, power: voltage * current, status: c.closed ? 'ok' : 'off' }
        break
      }
      case 'led':
      case 'diode': {
        const model = c.kind === 'led' ? LED_MODELS[c.color] : DIODE_MODEL
        const voltage = v(c.anode) - v(c.cathode)
        const current = (v(c.anode) - x[sys.extra[i]]) / model.rs
        const power = voltage * current
        // Reverse breakdown isn't modelled: past its rating the part still blocks, it is only flagged.
        // A burnt part reports the current at the moment of connection; real ones usually then fail open.
        if (c.kind === 'led') {
          const status: ComponentStatus =
            voltage < -LED_RATED_REVERSE_VOLTS ? 'overvoltage'
            : current < LED_ON_AMPS ? 'off'
            : current <= LED_MAX_AMPS ? 'ok'
            : current <= LED_BURNT_AMPS ? 'overcurrent'
            : 'burnt'
          const brightness = current < LED_ON_AMPS ? 0 : Math.sqrt(Math.min(current / LED_REF_AMPS, 1))
          components[c.id] = { current, voltage, power, status, brightness }
        } else {
          const status: ComponentStatus =
            voltage < -DIODE_RATED_REVERSE_VOLTS ? 'overvoltage'
            : current < 1e-6 ? 'off'
            : current > 1 ? 'burnt'
            : current > 0.2 ? 'overcurrent'
            : 'ok'
          components[c.id] = { current, voltage, power, status }
        }
        break
      }
      case 'vsource': {
        // The branch unknown is current entering + and flowing through the source to −.
        const current = -x[sys.extra[i]]
        const voltage = v(c.pos) - v(c.neg)
        let status: ComponentStatus = 'ok'
        if (Math.abs(current) > SHORT_CIRCUIT_AMPS) {
          status = 'burnt'
          error ??= `Short circuit: ${c.id}'s + and − are joined with almost no resistance, so a huge current would flow.`
        }
        components[c.id] = { current, voltage, power: -voltage * current, status }
        break
      }
    }
  }
  return error ? { ok: false, error, nodeVoltages, components } : { ok: true, nodeVoltages, components }
}

/**
 * Nodes with a conductive path to ground. Junctions count as connections (their real leakage
 * defines the node); open switches don't. Anything else only has a voltage because of gmin.
 */
function nodesConnectedToGround(circuit: Circuit): Set<NodeId> {
  const neighbours = new Map<NodeId, NodeId[]>()
  const link = (a: NodeId, b: NodeId) => {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b])
    neighbours.set(b, [...(neighbours.get(b) ?? []), a])
  }
  for (const c of circuit.components) {
    if (c.kind === 'switch' && !c.closed) continue
    const [a, b] = NODE_FIELDS[c.kind].map((f) => (c as unknown as Record<string, NodeId>)[f])
    link(a, b)
  }
  const reached = new Set<NodeId>([circuit.ground])
  const queue = [circuit.ground]
  for (let n = queue.pop(); n !== undefined; n = queue.pop()) {
    for (const m of neighbours.get(n) ?? []) {
      if (!reached.has(m)) {
        reached.add(m)
        queue.push(m)
      }
    }
  }
  return reached
}

/** Failed solve: no voltages, and every readable part zeroed so callers can still index by id. */
function failure(error: string, circuit: Circuit): SolveResult {
  const components: Record<string, ComponentResult> = {}
  const list = circuit && Array.isArray(circuit.components) ? circuit.components : []
  for (const c of list) {
    if (!c || typeof c !== 'object' || typeof c.id !== 'string') continue
    components[c.id] = { current: 0, voltage: 0, power: 0, status: 'off', ...(c.kind === 'led' ? { brightness: 0 } : {}) }
  }
  return { ok: false, error, nodeVoltages: {}, components }
}
