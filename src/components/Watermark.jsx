/**
 * Identity watermark — a faint, repeating overlay of the signed-in user's
 * email tiled diagonally across the whole viewport.
 *
 * Purpose is deterrence + attribution, not prevention: it does not stop a
 * screenshot, but any leaked screenshot carries the account it came from,
 * so a leak is traceable to a specific (revocable) user. Rendered once at
 * the app root with `position: fixed` so it covers every screen including
 * the full-screen image lightbox. `pointer-events: none` means it never
 * blocks interaction; a high z-index keeps it above enlarged images.
 */
export default function Watermark({ email }) {
  if (!email) return null

  // XML-escape so an email is always valid SVG text content (entities survive
  // the data-URI decode); then encodeURIComponent handles the URI layer.
  const label = String(email).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Size the SVG tile to the text so long emails don't clip when rotated.
  const w = Math.max(300, String(email).length * 11)
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
