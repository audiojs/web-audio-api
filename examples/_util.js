// Shared helpers for examples: arg parsing, numeric/time parsing, TTY key handling, live status line.

let semi = 'C.D.EF.G.A.B'

export let num = v => {
  v += ''
  let m = v.match(/^([A-G])([#b])?(-?\d)$/i)
  if (m) return 440 * 2 ** ((semi.indexOf(m[1].toUpperCase()) + (m[2] === '#') - (m[2] === 'b') + 12 * (+m[3] + 1) - 69) / 12)
  return parseFloat(v) * (/k$/i.test(v) ? 1e3 : 1)
}

export let sec = v => (v += '', parseFloat(v) * ({ s: 1, m: 60, h: 3600 }[v.slice(-1)] || 1))

// parse argv: positional tokens + k=v pairs + -d/--duration/--key=val long flags
export let args = (argv = process.argv.slice(2)) => {
  let kv = {}, pos = []
  for (let i = 0; i < argv.length; i++) {
    let s = argv[i]
    if (s === '-d' || s === '--duration') { kv.dur = argv[++i]; continue }
    if (s.startsWith('--')) {
      let e = s.indexOf('=')
      if (e > 0) kv[s.slice(2, e)] = s.slice(e + 1)
      else kv[s.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : true
      continue
    }
    let e = s.indexOf('=')
    if (e > 0) kv[s.slice(0, e)] = s.slice(e + 1)
    else pos.push(s)
  }
  let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
  return { kv, pos, $ }
}

// Raw-mode keyboard. bindings: { up, down, left, right, space, enter, '+', '-', letters }.
// Always binds q / Ctrl-C / Esc to quit. If ctx is passed, space toggles suspend/resume unless overridden.
export let keys = (bindings = {}, onQuit, ctx) => {
  let s = process.stdin
  let restore = () => { try { s.isTTY && s.setRawMode(false); s.pause() } catch {} }
  let quit = () => { restore(); onQuit?.(); process.exit(0) }
  // If ctx is passed and space is not explicitly bound, wire pause/resume.
  if (ctx && !bindings.space) {
    bindings.space = async () => {
      if (ctx.state === 'running') await ctx.suspend()
      else if (ctx.state === 'suspended') await ctx.resume()
    }
  }
  if (!s.isTTY) return quit
  s.setRawMode(true); s.resume(); s.setEncoding('utf8')
  let map = { '\u001b[A': 'up', '\u001b[B': 'down', '\u001b[C': 'right', '\u001b[D': 'left', ' ': 'space', '\r': 'enter', '\t': 'tab' }
  s.on('data', k => {
    if (k === '\u0003' || k === 'q' || k === 'Q' || k === '\u001b') return quit()
    let name = map[k] || k
    bindings[name]?.(k)
  })
  process.on('exit', restore)
  return quit
}

// Live single-line status: returns a function that overwrites the same terminal line.
export let status = () => {
  let last = ''
  return s => {
    if (s === last) return
    last = s
    if (process.stdout.isTTY) process.stdout.write('\r\x1b[K' + s)
    else process.stdout.write(s + '\n')
  }
}

export let clearLine = () => process.stdout.isTTY && process.stdout.write('\n')

// "paused" tag for status lines — inserts a marker when ctx is suspended.
export let pausedTag = ctx => ctx.state === 'suspended' ? ' ⏸ PAUSED' : ''

// Nearest-note name for a frequency (for display).
export let noteName = f => {
  let n = Math.round(12 * Math.log2(f / 440) + 69)
  let names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return names[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1)
}
