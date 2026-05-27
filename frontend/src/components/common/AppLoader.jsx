export default function AppLoader({
  message = "Loading workspace..."
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "20px",
        background: "#fcfcfd",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: "58px",
          height: "58px",
          border: "4px solid #065f46",
          borderTop: "4px solid transparent",
          borderRadius: "50%",
          animation: "spin 0.9s linear infinite",
        }}
      />

      <div
        style={{
          fontSize: "15px",
          fontWeight: 600,
          color: "#1f2937",
          fontFamily: "Geist, Arial, sans-serif",
        }}
      >
        {message}
      </div>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}