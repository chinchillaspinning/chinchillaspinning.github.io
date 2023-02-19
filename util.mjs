/**
 * @param {any} a
 * @param {any} b
 * @param {number} t
 * @returns {any}
 */
export function lerp(a, b, t){
	return a + (b - a) * t;
}

/**
 * @param {any} a
 * @param {any} b
 * @param {number} t
 * @returns {any}
 */
export function lerpClamped(a, b, t){
	return a + (b - a) * Math.max(0, Math.min(1, t));
}