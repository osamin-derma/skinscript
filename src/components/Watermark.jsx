/**
 * Brand watermark — a faint, repeating "SkinScript" mark tiled diagonally
 * across the whole viewport.
 *
 * Purpose is deterrence/branding, not prevention: it does not stop a
 * screenshot, but any captured content is visibly marked. Rendered once at
 * the app root with `position: fixed` so it covers every screen including
 * the full-screen image lightbox. `pointer-events: none` means it never
 * blocks interaction; a high z-index keeps it above enlarged images.
 */
export default function Watermark({ text = 'SkinScript' }) {
  // XML-escape so the text is always valid SVG content (entities survive the
  // data-URI decode); then encodeURIComponent handles the URI layer.
  const label = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Size the SVG tile to the text so longer labels don't clip when rotated.
  const w = Math.max(300, String(text).length * 13)
  const h = Math.round(w * 0.55)
  const tile =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
    `<text x='0' y='${Math.round(h / 2)}' transform='rotate(-30 ${w / 2} ${h / 2})' ` +
    `font-family='-apple-system,Segoe UI,Roboto,sans-serif' font-size='14' ` +
    `fill='#808080' fill-opacity='0.09'>${label}</text>` +
    `</svg>`

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(tile)}")`,
        backgroundRepeat: 'repeat',
      }}
    />
  )
}
