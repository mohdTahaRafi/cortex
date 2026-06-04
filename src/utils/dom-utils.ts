/**
 * Cortex — DOM Utilities (Adapter Pattern)
 *
 * Provides typed wrappers for DOM operations that would otherwise
 * require unsafe `as any` casts — particularly vendor-prefixed CSS
 * properties not included in TypeScript's CSSStyleDeclaration.
 *
 * Design Pattern: Adapter — adapts the untyped vendor-prefix API
 * into a typed, safe interface.
 */

/**
 * Set a CSS property with automatic vendor-prefix support.
 * Eliminates all `(el.style as any).webkitFoo = ...` casts.
 *
 * @example
 * setVendorStyle(el, "maskImage", `url("${encoded}")`);
 * // Sets both el.style.maskImage and el.style.webkitMaskImage
 */
export function setVendorStyle(
  el: HTMLElement,
  property: string,
  value: string,
): void {
  const style = el.style as unknown as Record<string, string>;
  style[property] = value;

  // Apply webkit prefix
  const capitalized = property.charAt(0).toUpperCase() + property.slice(1);
  style[`webkit${capitalized}`] = value;
}

/**
 * Clear a CSS property and its vendor-prefixed variant.
 *
 * @example
 * clearVendorStyle(el, "maskImage");
 */
export function clearVendorStyle(el: HTMLElement, property: string): void {
  setVendorStyle(el, property, "");
}
