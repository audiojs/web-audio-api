export const fixNANs = x => Number.isFinite(x) ? x : 0

export const rad2deg = r => r * 180.0 / Math.PI
