// Record the graph a piece of Web Audio code connects, and draw it.
// Works on any AudioNode prototype: this package's in Node, the browser's own on a page.

const escapeHTML = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
const r = value => Math.round(value * 10) / 10
const kHz = value => value >= 1000 ? `${r(value / 1000)} kHz` : `${r(value)} Hz`

// every connect() made while `run` executes, as { from, to } pairs
export async function recordConnections(proto, run) {
  let connect = proto.connect, edges = []
  proto.connect = function (destination, ...rest) {
    edges.push({ from: this, to: destination })
    return connect.call(this, destination, ...rest)
  }
  try { await run() } finally { proto.connect = connect }
  return edges
}

// which node exposes this AudioParam, and under which name
function ownerOf(param, nodes) {
  for (let node of nodes) {
    for (let proto = Object.getPrototypeOf(node); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
      for (let key of Object.getOwnPropertyNames(proto)) {
        if (key.startsWith('_') || !Object.getOwnPropertyDescriptor(proto, key).get) continue
        try { if (node[key] === param) return { node, key } } catch { continue }
      }
    }
  }
  return null
}

// the nodes those pairs touch, with AudioParam targets resolved to their node and name
export function resolveGraph(edges) {
  let nodes = []
  let add = node => { if (!nodes.includes(node)) nodes.push(node) }
  for (let { from, to } of edges) { add(from); if (typeof to.connect === 'function') add(to) }
  let resolved = edges.map(({ from, to }) => {
    if (typeof to.connect === 'function') return { from, to, param: null }
    let owner = ownerOf(to, nodes)
    if (!owner) { add(to); return { from, to, param: null } }
    return { from, to: owner.node, param: owner.key }
  })
  return { nodes, edges: resolved }
}

// Nodes that play the same role many times over, one per voice, drawn once with
// a count. A role is the node's type together with the types it feeds and is fed by.
export function collapseGraph(nodes, edges) {
  let name = n => n.constructor.name
  let port = e => (e.param ? `.${e.param}` : '')
  let role = new Map(nodes.map(n => [n, [name(n),
    edges.filter(e => e.from === n).map(e => name(e.to) + port(e)).sort().join(),
    edges.filter(e => e.to === n).map(e => name(e.from) + port(e)).sort().join()].join('|')]))
  let first = new Map(), counts = new Map()
  for (let n of nodes) {
    let key = role.get(n)
    if (!first.has(key)) first.set(key, n)
    counts.set(first.get(key), (counts.get(first.get(key)) || 0) + 1)
  }
  let kept = [...first.values()]
  let seen = new Set(), merged = []
  for (let e of edges) {
    let from = first.get(role.get(e.from)), to = first.get(role.get(e.to))
    let key = `${kept.indexOf(from)}>${kept.indexOf(to)}${port(e)}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push({ from, to, param: e.param })
  }
  return { nodes: kept, edges: merged, counts }
}

const describe = {
  OscillatorNode: n => `${n.type} ${kHz(n.frequency.value)}`,
  AudioBufferSourceNode: n => n.buffer ? `${n.buffer.length} sample${n.buffer.length === 1 ? '' : 's'}` : '',
  ConstantSourceNode: n => `offset ${r(n.offset.value)}`,
  GainNode: n => `gain ${r(n.gain.value * 100) / 100}`,
  DelayNode: n => `${r(n.delayTime.value * 1000)} ms`,
  BiquadFilterNode: n => `${n.type} ${kHz(n.frequency.value)}`,
  DynamicsCompressorNode: n => `${r(n.threshold.value)} dB, ${r(n.ratio.value)}:1`,
  StereoPannerNode: n => `pan ${r(n.pan.value)}`,
  PannerNode: n => `${n.panningModel}`,
  AnalyserNode: n => `fftSize ${n.fftSize}`,
  ConvolverNode: n => n.buffer ? `${r(n.buffer.duration)} s IR` : '',
  WaveShaperNode: n => n.curve ? `${n.curve.length} points` : '',
  ChannelSplitterNode: n => `${n.numberOfOutputs} out`,
  ChannelMergerNode: n => `${n.numberOfInputs} in`,
  AudioWorkletNode: n => '',
  MediaStreamAudioSourceNode: n => 'microphone',
  AudioDestinationNode: n => `${n.channelCount} ch, ${kHz(n.context.sampleRate)}`,
  AudioParam: () => '',
}

const CHAR = 6.6, PAD = 14, ROW_GAP = 40, COL_GAP = 24, MARGIN = 24, LOOP = 28

function elbow(x1, y1, x2, y2) {
  if (Math.abs(x2 - x1) < 1) return `M${r(x1)} ${r(y1)}V${r(y2)}`
  let mid = (y1 + y2) / 2, rad = Math.min(8, Math.abs(x2 - x1) / 2), dir = Math.sign(x2 - x1)
  return `M${r(x1)} ${r(y1)}V${r(mid - rad)}q0 ${rad} ${dir * rad} ${rad}H${r(x2 - dir * rad)}q${dir * rad} 0 ${dir * rad} ${rad}V${r(y2)}`
}

// layered top-down layout: longest path from the sources, back edges looped on the right
let drawn = 0
export function graphSVG(nodes, edges, label = 'Audio graph', counts = new Map()) {
  let arrow = `arrow-${drawn}`, shade = `shade-${drawn++}`
  let out = new Map(nodes.map(n => [n, edges.filter(e => e.from === n)]))
  let back = new Set(), state = new Map(), order = []
  let visit = n => {
    state.set(n, 1)
    for (let e of out.get(n)) {
      let s = state.get(e.to) || 0
      if (s === 1) back.add(e)
      else if (!s) visit(e.to)
    }
    state.set(n, 2)
    order.unshift(n)
  }
  for (let n of nodes) if (!state.get(n)) visit(n)
  let layer = new Map(nodes.map(n => [n, 0]))
  for (let n of order) for (let e of out.get(n)) if (!back.has(e)) layer.set(e.to, Math.max(layer.get(e.to), layer.get(n) + 1))
  let rows = []
  for (let n of nodes) (rows[layer.get(n)] ||= []).push(n)
  let box = new Map(nodes.map(n => {
    let name = n.constructor.name, count = counts.get(n) || 1
    let sub = count > 1 ? `${count} nodes` : describe[name]?.(n) ?? ''
    return [n, { name, sub, w: Math.max(name.length, sub.length) * CHAR + PAD * 2, h: sub ? 44 : 30 }]
  }))
  let rowWidth = rows.map(row => row.reduce((sum, n) => sum + box.get(n).w, 0) + COL_GAP * (row.length - 1))
  let loopRoom = back.size ? LOOP + 8 : 0
  let width = Math.max(...rowWidth) + MARGIN * 2 + loopRoom
  let y = MARGIN
  for (let [i, row] of rows.entries()) {
    let x = (width - loopRoom - rowWidth[i]) / 2
    let h = Math.max(...row.map(n => box.get(n).h))
    for (let n of row) { let b = box.get(n); b.x = x; b.y = y + (h - b.h) / 2; x += b.w + COL_GAP }
    y += h + ROW_GAP
  }
  let height = y - ROW_GAP + MARGIN
  let loopX = Math.max(...[...box.values()].map(b => b.x + b.w)) + LOOP
  let paths = edges.map(e => {
    let a = box.get(e.from), b = box.get(e.to)
    let cls = e.param ? 'edge param' : 'edge'
    if (back.has(e)) {
      let y1 = a.y + a.h / 2, y2 = b.y + b.h / 2
      return `<path class="${cls} back" marker-end="url(#${arrow})" d="M${r(a.x + a.w)} ${r(y1)}H${r(loopX - 8)}q8 0 8 -8V${r(y2 + 8)}q0 -8 -8 -8H${r(b.x + b.w + 1)}"/>`
    }
    let x2 = b.x + b.w / 2
    let tag = e.param ? `<text class="edge-label" x="${r(x2 + 6)}" y="${r(b.y - 6)}">.${escapeHTML(e.param)}</text>` : ''
    return `<path class="${cls}" marker-end="url(#${arrow})" d="${elbow(a.x + a.w / 2, a.y + a.h, x2, b.y - 1)}"/>${tag}`
  })
  let boxes = nodes.map(n => {
    let b = box.get(n)
    return `<g class="node" transform="translate(${r(b.x)} ${r(b.y)})"><rect class="card" width="${r(b.w)}" height="${b.h}" rx="8" filter="url(#${shade})"/><rect class="sheen" x="1" y="1" width="${r(b.w - 2)}" height="${b.h - 2}" rx="7"/><text x="${r(b.w / 2)}" y="${b.sub ? 18 : 19}">${escapeHTML(b.name)}</text>${b.sub ? `<text class="sub" x="${r(b.w / 2)}" y="33">${escapeHTML(b.sub)}</text>` : ''}</g>`
  })
  return `<svg class="graph" width="${r(width)}" height="${r(height)}" viewBox="0 0 ${r(width)} ${r(height)}" role="img" aria-label="${escapeHTML(label)}: ${nodes.map(n => n.constructor.name).join(', ')}"><defs><marker id="${arrow}" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 8 4 0 8z"/></marker><filter id="${shade}" x="-20%" y="-30%" width="140%" height="190%"><feMorphology in="SourceAlpha" operator="erode" radius="4" result="thinner"/><feGaussianBlur in="thinner" stdDeviation="9" result="soft"/><feOffset in="soft" dy="8" result="cast"/><feFlood class="shadow-far" result="tint"/><feComposite in="tint" in2="cast" operator="in" result="far"/><feDropShadow class="shadow-near" in="SourceGraphic" dx="0" dy="1.5" stdDeviation="1.5" result="near"/><feMerge><feMergeNode in="far"/><feMergeNode in="near"/></feMerge></filter></defs>${paths.join('')}${boxes.join('')}</svg>`
}
