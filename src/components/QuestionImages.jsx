import { useState } from 'react'
import { X, ZoomIn } from 'lucide-react'

/**
 * Renders the question's clinical photos / diagrams.
 *
 *   - Up to 2 images side-by-side on wide screens, stacked on mobile.
 *   - Tap any thumbnail to open a full-screen lightbox.
 *   - `loading="lazy"` so a long quiz doesn't preload 80MB of photos.
 */
export default function QuestionImages({ images, darkMode, compact = false }) {
  const [open, setOpen] = useState(null) // index of expanded image, or null

  if (!images || images.length === 0) return null

  return (
    <>
      <div className={`grid gap-3 mb-5 ${
        images.length === 1 ? 'grid-cols-1' :
        images.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
        'grid-cols-2 md:grid-cols-3'
      }`}>
        {images.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpen(i)}
            className={`group relative overflow-hidden rounded-xl border transition hover:shadow-md ${
              darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'
            }`}
            aria-label={`Open image ${i + 1}`}
          >
            <img
              src={url}
              alt={`Clinical image ${i + 1}`}
              loading="lazy"
              className={`w-full object-contain ${compact ? 'max-h-40' : 'max-h-72'}`}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition">
              <ZoomIn size={14} />
            </div>
          </button>
        ))}
      </div>

      {open !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-zoom-out"
          onClick={() => setOpen(null)}
          role="dialog"
        >
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <img
            src={images[open]}
            alt={`Clinical image ${open + 1}`}
            className="max-h-[92vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs">
              {open + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </>
  )
}
