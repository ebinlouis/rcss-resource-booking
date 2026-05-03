import { useState } from "react"
import { createPortal } from "react-dom"

function BookingModal({ spaceName, onClose }) {

  const [formData, setFormData] = useState({
    purpose: "",
    department: "",
    date: "",
    start: "",
    end: "",
    attendees: "",
    requester: "Admin",
    requirements: [],
    notes: ""
  })

  const departments = [
    "Dept. of Social Work",
    "Dept. of Computer Science",
    "Dept. of Library and Information Science",
    "Dept. of Business Administration",
    "Dept. of Commerce",
    "Dept. of Psychology",
    "Dept. of Languages",
    "Dept. of Physical Education",
    "Dept. of Biosciences",
    "Dept. of Statistics",
    "Dept. of Management & Professional Studies"
  ]

  const toggleRequirement = (item) => {
    setFormData((prev) => ({
      ...prev,
      requirements: prev.requirements.includes(item)
        ? prev.requirements.filter((i) => i !== item)
        : [...prev.requirements, item]
    }))
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">

      <div className="bg-white w-full max-w-4xl rounded-xl flex overflow-hidden shadow-lg">
        {/* LEFT PANEL */}
        <div className="hidden md:flex md:w-1/3 bg-gradient-to-b from-green-900 to-blue-900 text-white p-6 flex flex-col justify-between">

          <div>
            <p className="text-sm uppercase opacity-70">
              New Booking
            </p>

            <h2 className="text-2xl font-bold mt-2">
              {spaceName}
            </h2>

            <p className="text-sm mt-4 opacity-80">
              Submit a structured request with time,
              requirements, and approval context.
            </p>
          </div>

          <div className="space-y-3 mt-6">

            <div className="bg-white/10 p-3 rounded-lg">
              <p className="text-sm">Selected slot</p>
              <p className="font-semibold">10:00 - 12:00</p>
            </div>

            <div className="flex gap-3">
              <div className="bg-white/10 p-3 rounded-lg text-sm">
                Approval <br /> <b>Admin review</b>
              </div>

              <div className="bg-white/10 p-3 rounded-lg text-sm">
                Policy <br /> <b>48h notice</b>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-full md:w-2/3 p-6 overflow-y-auto max-h-[90vh]">

          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Complete booking form
            </h2>

            <button onClick={onClose}>✕</button>
          </div>

          {/* FORM */}
          <div className="grid grid-cols-2 gap-4">

            {/* Purpose */}
            <input
              placeholder="Purpose"
              className="border p-2 rounded"
              value={formData.purpose}
              onChange={(e) =>
                setFormData({ ...formData, purpose: e.target.value })
              }
            />

            {/* Department */}
            <select
              className="border p-2 rounded bg-white"
              value={formData.department}
              onChange={(e) =>
                setFormData({ ...formData, department: e.target.value })
              }
            >
              <option value="">Select Department</option>
              {departments.map((dept, index) => (
                <option key={index} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {/* Date */}
            <input
              type="date"
              className="border p-2 rounded"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
            />

            {/* Start Time */}
            <input
              type="time"
              className="border p-2 rounded"
              value={formData.start}
              onChange={(e) =>
                setFormData({ ...formData, start: e.target.value })
              }
            />

            {/* End Time */}
            <input
              type="time"
              className="border p-2 rounded"
              value={formData.end}
              onChange={(e) =>
                setFormData({ ...formData, end: e.target.value })
              }
            />

            {/* Attendees */}
            <input
              placeholder="Expected attendees"
              type="number"
              className="border p-2 rounded"
              value={formData.attendees}
              onChange={(e) =>
                setFormData({ ...formData, attendees: e.target.value })
              }
            />

            {/* Requester */}
            <div className="border p-2 rounded bg-gray-100 text-gray-700">
              {formData.requester}
            </div>

          </div>

          {/* REQUIREMENTS */}
          <div className="mt-6">
            <h3 className="font-semibold mb-2">Requirements</h3>

            <div className="grid grid-cols-2 gap-3">

              {["Projector", "Microphone", "AC", "AV Support"].map((item) => (
                <div
                  key={item}
                  onClick={() => toggleRequirement(item)}
                  className={`border p-3 rounded-lg cursor-pointer transition ${
                    formData.requirements.includes(item)
                      ? "bg-green-100 border-green-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {item}
                </div>
              ))}

            </div>
          </div>

          {/* NOTES */}
          <div className="mt-6">
            <textarea
              placeholder="Notes for approving office"
              className="w-full border p-3 rounded"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
            />
          </div>

          {/* FOOTER */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="border px-4 py-2 rounded"
            >
              Cancel
            </button>

            <button
              onClick={() => console.log(formData)}
              className="bg-green-700 text-white px-4 py-2 rounded"
            >
              Send request
            </button>
          </div>

        </div>

      </div>
    </div>,
  document.body
)
}

export default BookingModal