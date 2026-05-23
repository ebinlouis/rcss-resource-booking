import { useState, useRef } from "react"
import { createPortal } from "react-dom"

/**
 * Tooltip — wraps any element and shows a plain-language hint on hover.
 *
 * Usage:
 *   <Tooltip text="What this button does">
 *     <button>...</button>
 *   </Tooltip>
 *
 * Props:
 *   text        — the hint string (required)
 *   position    — "top" | "bottom" | "left" | "right"  (default "top")
 *   delay       — ms before showing (default 400)
 */
function Tooltip({ children, text, position = "top", delay = 400 }) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords]   = useState({ top: 0, left: 0 })
  const timerRef              = useRef(null)
  const wrapRef               = useRef(null)

  if (!text) return children

  const show = () => {
    timerRef.current = setTimeout(() => {
      if (!wrapRef.current) return
      const rect = wrapRef.current.getBoundingClientRect()
      const GAP  = 8

      let top, left
      if (position === "top") {
        top  = rect.top  + window.scrollY - GAP
        left = rect.left + window.scrollX + rect.width / 2
      } else if (position === "bottom") {
        top  = rect.bottom + window.scrollY + GAP
        left = rect.left   + window.scrollX + rect.width / 2
      } else if (position === "left") {
        top  = rect.top  + window.scrollY + rect.height / 2
        left = rect.left + window.scrollX - GAP
      } else {
        top  = rect.top   + window.scrollY + rect.height / 2
        left = rect.right + window.scrollX + GAP
      }
      setCoords({ top, left })
      setVisible(true)
    }, delay)
  }

  const hide = () => {
    clearTimeout(timerRef.current)
    setVisible(false)
  }

  const transformMap = {
    top:    "translate(-50%, -100%)",
    bottom: "translate(-50%, 0)",
    left:   "translate(-100%, -50%)",
    right:  "translate(0, -50%)",
  }

  return (
    <>
      <span
        ref={wrapRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </span>

      {visible && createPortal(
        <div
          role="tooltip"
          style={{
            position:  "absolute",
            top:       coords.top,
            left:      coords.left,
            transform: transformMap[position],
            zIndex:    9999,
          }}
          className="pointer-events-none max-w-[220px] px-3 py-2 rounded-xl bg-gray-900 text-white text-xs leading-snug shadow-xl animate-in fade-in duration-150"
        >
          {text}
          {/* Arrow */}
          <span
            className={`absolute w-2 h-2 bg-gray-900 rotate-45 ${
              position === "top"    ? "bottom-[-4px] left-1/2 -translate-x-1/2" :
              position === "bottom" ? "top-[-4px]    left-1/2 -translate-x-1/2" :
              position === "left"   ? "right-[-4px]  top-1/2  -translate-y-1/2" :
                                      "left-[-4px]   top-1/2  -translate-y-1/2"
            }`}
          />
        </div>,
        document.body
      )}
    </>
  )
}

export default Tooltip