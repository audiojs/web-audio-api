export const BLOCK_SIZE = 128

// fp-safe ceiling: if value is within 1e-8 of an integer, snap to it
export const fpCeil = v => { let r = Math.round(v); return Math.abs(v - r) < 1e-8 ? r : Math.ceil(v) }
