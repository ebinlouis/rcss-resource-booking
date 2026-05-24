import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"

/**
 * PageInfo — an ⓘ icon next to a page title.
 * Hover on desktop, tap on mobile to show a description tooltip.
 */
export default function PageInfo({ text, position = "bottom" }) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords]   = useState({ top: 0, left: 0 })
  const ref = useRef(null)

  const show = () => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setCoords({
      top:  position === "bottom" ? rect.bottom + window.scrollY + 8 : rect.top + window.scrollY - 8,
      left: rect.left + window.scrollX + rect.width / 2,
    })
    setVisible(true)
  }

  const hide = () => setVisible(false)
  const toggle = () => visible ? hide() : show()

  // close on outside click (mobile)
  useEffect(() => {
    if (!visible) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) hide() }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [visible])

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={toggle}
        aria-label="Page information"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[#4a6b58] hover:bg-[#d1fae5] transition-colors focus:outline-none"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 opacity-70">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </button>

      {visible && createPortal(
        <div
          role="tooltip"
          style={{
            position:  "absolute",
            top:       coords.top,
            left:      coords.left,
            transform: "translateX(-50%)",
            zIndex:    9999,
          }}
          className="pointer-events-none max-w-[260px] px-3.5 py-2.5 rounded-xl bg-gray-900 text-white text-xs leading-relaxed shadow-xl animate-in fade-in duration-150"
        >
          {text}
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45" />
        </div>,
        document.body
      )}
    </>
  )
}