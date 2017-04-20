exports.fixNANs = x => Number.isFinite(x) ? x : 0

exports.rad2deg = r => r * 180.0 / Math.PI

exports.clampTo = (value, min, max) => Math.min(Math.max(min, value), max)
