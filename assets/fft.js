/**
 * FFT for real and complex signals.
 *
 * @module fourier-transform
 */

const { sqrt, sin, cos, abs, SQRT1_2, SQRT2 } = Math
const TWO_PI = 6.283185307179586

// Per-size cached buffers and precomputed twiddle factors
const cache = new Map()
let lastN = 0, lastEntry = null

function init(N) {
	const half = N >>> 1
	const x = new Float64Array(N)
	const spectrum = new Float64Array(half)
	const im = new Float64Array(half + 1)
	const re = x.subarray(0, half + 1) // zero-copy view into x
	const complex = [re, im]
	const bSi = 2 / N

	// Precompute bit-reversal permutation table
	const bits = 31 - Math.clz32(N)
	const perm = new Uint32Array(N)
	for (let i = 0; i < N; i++) {
		let rev = 0, v = i
		for (let j = 0; j < bits; j++) {
			rev = (rev << 1) | (v & 1)
			v >>= 1
		}
		perm[i] = rev
	}

	// Count twiddle factors per stage
	let total = 0, n2 = 2, nn = half
	const stages = []
	while ((nn = nn >>> 1)) {
		n2 = n2 << 1
		const n8 = n2 >>> 3
		const count = n8 > 1 ? n8 - 1 : 0
		stages.push({ offset: total, count })
		total += count
	}

	// Interleaved twiddle table: [cc1, ss1, cc3, ss3] per entry
	const tw = new Float64Array(total << 2)
	n2 = 2; nn = half
	let si = 0
	while ((nn = nn >>> 1)) {
		n2 = n2 << 1
		const n8 = n2 >>> 3
		const e = TWO_PI / n2
		const off = stages[si].offset << 2
		for (let j = 1; j < n8; j++) {
			const a = j * e
			const s = sin(a), c = cos(a)
			const idx = off + ((j - 1) << 2)
			tw[idx] = c
			tw[idx + 1] = s
			tw[idx + 2] = 4 * c * (c * c - 0.75)
			tw[idx + 3] = 4 * s * (0.75 - s * s)
		}
		si++
	}

	const entry = { x, spectrum, complex, bSi, tw, stages, perm }
	cache.set(N, entry)
	return entry
}

function getEntry(N) {
	if (N === lastN) return lastEntry
	const entry = cache.get(N) || init(N)
	lastN = N
	lastEntry = entry
	return entry
}

// Shared butterfly computation
function transform(input) {
	const N = input.length
	if (N < 2 || (N & (N - 1))) throw Error('Input length must be a power of 2 (>= 2).')

	const entry = getEntry(N)
	const { x, tw, stages, perm } = entry

	// Bit-reversal permutation via precomputed table
	for (let i = 0; i < N; i++) x[i] = input[perm[i]]

	// First pass: length-2 butterflies
	for (let ix = 0, id = 4; ix < N; id *= 4) {
		for (let i0 = ix; i0 < N; i0 += id) {
			const t = x[i0] - x[i0 + 1]
			x[i0] += x[i0 + 1]
			x[i0 + 1] = t
		}
		ix = 2 * (id - 1)
	}

	// Subsequent stages
	let n2 = 2, nn = N >>> 1, si = 0
	while ((nn = nn >>> 1)) {
		let ix = 0
		n2 = n2 << 1
		let id = n2 << 1
		const n4 = n2 >>> 2
		const n8 = n2 >>> 3

		do {
			if (n4 !== 1) {
				for (let i0 = ix; i0 < N; i0 += id) {
					let i1 = i0, i2 = i1 + n4, i3 = i2 + n4, i4 = i3 + n4

					let t1 = x[i3] + x[i4]
					x[i4] -= x[i3]
					x[i3] = x[i1] - t1
					x[i1] += t1

					i1 += n8; i2 += n8; i3 += n8; i4 += n8

					t1 = x[i3] + x[i4]
					let t2 = x[i3] - x[i4]
					t1 = -t1 * SQRT1_2
					t2 *= SQRT1_2

					const st1 = x[i2]
					x[i4] = t1 + st1
					x[i3] = t1 - st1
					x[i2] = x[i1] - t2
					x[i1] += t2
				}
			} else {
				for (let i0 = ix; i0 < N; i0 += id) {
					const i1 = i0, i3 = i1 + 2, i4 = i3 + 1
					const t1 = x[i3] + x[i4]
					x[i4] -= x[i3]
					x[i3] = x[i1] - t1
					x[i1] += t1
				}
			}
			ix = (id << 1) - n2
			id = id << 2
		} while (ix < N)

		// Twiddle factor butterflies
		const { offset, count } = stages[si]
		for (let j = 0; j < count; j++) {
			const ti = (offset + j) << 2
			const cc1 = tw[ti], ss1 = tw[ti + 1], cc3 = tw[ti + 2], ss3 = tw[ti + 3]

			ix = 0; id = n2 << 1
			do {
				for (let i0 = ix; i0 < N; i0 += id) {
					const i1 = i0 + j + 1
					const i2 = i1 + n4
					const i3 = i2 + n4
					const i4 = i3 + n4
					const i5 = i0 + n4 - j - 1
					const i6 = i5 + n4
					const i7 = i6 + n4
					const i8 = i7 + n4

					let t2 = x[i7] * cc1 - x[i3] * ss1
					let t1 = x[i7] * ss1 + x[i3] * cc1
					let t4 = x[i8] * cc3 - x[i4] * ss3
					let t3 = x[i8] * ss3 + x[i4] * cc3

					const st1 = t2 - t4
					t2 += t4
					t4 = st1

					x[i8] = t2 + x[i6]
					x[i3] = t2 - x[i6]

					const st2 = t3 - t1
					t1 += t3
					t3 = st2

					x[i4] = t3 + x[i2]
					x[i7] = t3 - x[i2]

					x[i6] = x[i1] - t1
					x[i1] += t1

					x[i2] = t4 + x[i5]
					x[i5] -= t4
				}
				ix = (id << 1) - n2
				id = id << 2
			} while (ix < N)
		}
		si++
	}

	return entry
}

/**
 * Compute magnitude spectrum of real-valued input.
 * @param {ArrayLike<number>} input - length must be power of 2 (>= 2).
 * @param {Float64Array} [output] - Optional buffer (length N/2). If omitted, returns internal view (overwritten on next call with same N).
 * @returns {Float64Array} Magnitude spectrum, length N/2.
 */
export default function rfft(input, output) {
	const entry = transform(input)
	const N = input.length
	const { x, spectrum, bSi } = entry
	const out = output || spectrum

	let i = N >>> 1
	while (--i) {
		const rval = x[i], ival = x[N - i]
		out[i] = bSi * sqrt(rval * rval + ival * ival)
	}
	out[0] = abs(bSi * x[0])

	return out
}

// --- Complex radix-2 Cooley-Tukey FFT (in-place) ---

const cCache = new Map()
let cLastN = 0, cLastEntry = null

function cInit(N) {
	const bits = 31 - Math.clz32(N)
	const perm = new Uint32Array(N)
	for (let i = 0; i < N; i++) {
		let rev = 0, v = i
		for (let j = 0; j < bits; j++) { rev = (rev << 1) | (v & 1); v >>= 1 }
		perm[i] = rev
	}
	// Separate forward/inverse twiddle tables (no per-butterfly dir multiply)
	const twRe = new Float64Array(N)
	const twFwd = new Float64Array(N)
	const twInv = new Float64Array(N)
	let ti = 0
	for (let len = 2; len <= N; len <<= 1) {
		const half = len >> 1, angle = TWO_PI / len
		for (let j = 0; j < half; j++) {
			const s = sin(j * angle)
			twRe[ti] = cos(j * angle)
			twFwd[ti] = -s
			twInv[ti] = s
			ti++
		}
	}
	const entry = { perm, twRe, twFwd, twInv }
	cCache.set(N, entry)
	return entry
}

function cGetEntry(N) {
	if (N === cLastN) return cLastEntry
	const entry = cCache.get(N) || cInit(N)
	cLastN = N
	cLastEntry = entry
	return entry
}

function cTransform(re, im, inverse) {
	const N = re.length
	if (N < 2 || (N & (N - 1))) throw Error('Length must be a power of 2 (>= 2).')
	const entry = cGetEntry(N)
	const { perm, twRe } = entry
	const twIm = inverse ? entry.twInv : entry.twFwd

	// Bit-reversal permutation (in-place swap)
	for (let i = 0; i < N; i++) {
		const j = perm[i]
		if (i < j) {
			let t = re[i]; re[i] = re[j]; re[j] = t
			t = im[i]; im[i] = im[j]; im[j] = t
		}
	}

	// Butterfly stages
	let ti = 0
	for (let len = 2; len <= N; len <<= 1) {
		const half = len >> 1
		for (let i = 0; i < N; i += len) {
			for (let j = 0; j < half; j++) {
				const wRe = twRe[ti + j], wIm = twIm[ti + j]
				const a = i + j, b = a + half
				const tRe = wRe * re[b] - wIm * im[b]
				const tIm = wRe * im[b] + wIm * re[b]
				re[b] = re[a] - tRe; im[b] = im[a] - tIm
				re[a] += tRe; im[a] += tIm
			}
		}
		ti += half
	}

	if (inverse) {
		const inv = 1 / N
		for (let i = 0; i < N; i++) { re[i] *= inv; im[i] *= inv }
	}
}

/**
 * In-place complex forward FFT (unnormalized).
 * @param {Float64Array} re - Real parts (length must be power of 2, >= 2).
 * @param {Float64Array} im - Imaginary parts (same length).
 */
export function cfft(re, im) { cTransform(re, im, false) }

/**
 * In-place complex inverse FFT (1/N normalized).
 * @param {Float64Array} re - Real parts (length must be power of 2, >= 2).
 * @param {Float64Array} im - Imaginary parts (same length).
 */
export function cifft(re, im) { cTransform(re, im, true) }

/**
 * Compute complex spectrum of real-valued input (unnormalized DFT).
 * @param {ArrayLike<number>} input - length must be power of 2 (>= 2).
 * @param {[Float64Array, Float64Array]} [output] - Optional [re, im] buffers (length N/2+1 each). If omitted, returns internal view.
 * @returns {[Float64Array, Float64Array]} Complex spectrum [re, im], N/2+1 bins (DC through Nyquist).
 */
export function fft(input, output) {
	const entry = transform(input)
	const N = input.length
	const half = N >>> 1
	const { x, complex } = entry

	if (output) {
		const re = output[0], im = output[1]
		for (let k = 0; k <= half; k++) re[k] = x[k]
		im[0] = 0; im[half] = 0
		for (let k = 1; k < half; k++) im[k] = x[N - k]
		return output
	}

	// re is already a zero-copy view of x[0..half] — no copy needed
	const im = complex[1]
	im[0] = 0; im[half] = 0
	for (let k = 1; k < half; k++) im[k] = x[N - k]

	return complex
}

// Inverse split-radix DIF core — mirror of forward DIT transform()
function inverseTransform(N, entry) {
	const { x, tw, stages, perm } = entry
	const numStages = stages.length

	// DIF: butterflies from large n2 to small (reverse of forward)
	let n2 = N << 1
	for (let s = 0; s < numStages; s++) {
		n2 >>= 1
		const n4 = n2 >>> 2
		const n8 = n4 >>> 1
		const si = numStages - 1 - s

		// Zero-angle butterflies
		let ix = 0, id = n2 << 1
		do {
			for (let i0 = ix; i0 < N; i0 += id) {
				const i1 = i0, i2 = i1 + n4, i3 = i2 + n4, i4 = i3 + n4

				let t1 = x[i1] - x[i3]
				x[i1] += x[i3]
				x[i2] += x[i2]
				x[i4] += x[i4]
				x[i3] = t1 - x[i4]
				x[i4] += t1
			}
			ix = (id << 1) - n2
			id <<= 2
		} while (ix < N)

		// SQRT2 section (only when n8 >= 1, i.e. n4 !== 1)
		if (n8 >= 1) {
			ix = 0; id = n2 << 1
			do {
				for (let i0 = ix; i0 < N; i0 += id) {
					const j1 = i0 + n8, j2 = j1 + n4, j3 = j2 + n4, j4 = j3 + n4

					let t1 = x[j1] - x[j2]
					x[j1] += x[j2]
					let t2 = x[j4] + x[j3]
					x[j2] = x[j4] - x[j3]
					t2 = -t2 * SQRT2
					t1 *= SQRT2
					x[j3] = t2 + t1
					x[j4] = t2 - t1
				}
				ix = (id << 1) - n2
				id <<= 2
			} while (ix < N)
		}

		// Twiddle factor butterflies (same twiddles, inverse operations)
		const { offset, count } = stages[si]
		for (let j = 0; j < count; j++) {
			const ti = (offset + j) << 2
			const cc1 = tw[ti], ss1 = tw[ti + 1], cc3 = tw[ti + 2], ss3 = tw[ti + 3]

			ix = 0; id = n2 << 1
			do {
				for (let i0 = ix; i0 < N; i0 += id) {
					const i1 = i0 + j + 1
					const i2 = i1 + n4
					const i3 = i2 + n4
					const i4 = i3 + n4
					const i5 = i0 + n4 - j - 1
					const i6 = i5 + n4
					const i7 = i6 + n4
					const i8 = i7 + n4

					let t1 = x[i1] - x[i6]
					x[i1] += x[i6]
					let t2 = x[i5] - x[i2]
					x[i5] += x[i2]
					let t3 = x[i8] + x[i3]
					x[i6] = x[i8] - x[i3]
					let t4 = x[i4] + x[i7]
					x[i2] = x[i4] - x[i7]

					const t5 = t1 - t4
					t1 += t4
					t4 = t2 - t3
					t2 += t3

					x[i7] = t5 * ss1 - t4 * cc1
					x[i3] = t5 * cc1 + t4 * ss1
					x[i4] = t1 * cc3 - t2 * ss3
					x[i8] = t1 * ss3 + t2 * cc3
				}
				ix = (id << 1) - n2
				id <<= 2
			} while (ix < N)
		}
	}

	// Length-2 butterflies (self-inverse up to scaling)
	for (let ix = 0, id = 4; ix < N; id *= 4) {
		for (let i0 = ix; i0 < N; i0 += id) {
			const t = x[i0] - x[i0 + 1]
			x[i0] += x[i0 + 1]
			x[i0 + 1] = t
		}
		ix = 2 * (id - 1)
	}

	// Bit-reversal permutation (in-place swap)
	for (let i = 0; i < N; i++) {
		const j = perm[i]
		if (i < j) { const t = x[i]; x[i] = x[j]; x[j] = t }
	}

	// Scale by 1/N
	const inv = 1 / N
	for (let i = 0; i < N; i++) x[i] *= inv
}

/**
 * Inverse real FFT — recover time-domain signal from complex spectrum.
 * Uses native split-radix DIF algorithm (no complex FFT overhead).
 * @param {Float64Array} re - Real parts (length N/2+1).
 * @param {Float64Array} im - Imaginary parts (length N/2+1).
 * @param {Float64Array} [output] - Optional buffer (length N). If omitted, returns internal view (overwritten on next call with same N).
 * @returns {Float64Array} Real time-domain signal, length N.
 */
export function ifft(re, im, output) {
	const bins = re.length
	const N = (bins - 1) << 1
	if (N < 2 || (N & (N - 1))) throw Error('Input must have N/2+1 bins where N is power of 2 (>= 2).')

	const entry = getEntry(N)
	const { x } = entry
	const half = N >>> 1

	// Pack into half-complex format: x[k]=Re(X[k]), x[N-k]=Im(X[k])
	x[0] = re[0]
	x[half] = re[half]
	for (let k = 1; k < half; k++) {
		x[k] = re[k]
		x[N - k] = im[k]
	}

	inverseTransform(N, entry)

	if (output) {
		for (let i = 0; i < N; i++) output[i] = x[i]
		return output
	}
	return x
}
