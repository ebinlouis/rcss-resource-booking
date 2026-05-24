// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion"
import { Users, Info, Lightbulb } from "lucide-react"

export default function SpaceSuggestions({ suggestedHalls = [], onSwitch }) {
  if (suggestedHalls.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -5, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -5, height: 0 }}
        className="mb-6 rounded-lg bg-indigo-50 border border-indigo-100 p-4"
      >
        <div className="flex gap-3">
          <Lightbulb className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-indigo-900 mb-1">
              Alternative Spaces Suggested
            </h4>
            <p className="text-xs text-indigo-700 mb-3 leading-relaxed">
              Based on your requirements, these spaces might be a better fit.
              Switching can help optimize campus resource utilization.
            </p>
            
            <div className="space-y-2">
              {suggestedHalls.map((hall) => (
                <div
                  key={hall.id}
                  className="flex items-center justify-between bg-white rounded border border-indigo-50 p-2 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {hall.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Cap: {hall.capacity_hard}
                      </span>
                      {hall.space_type && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span className="capitalize">{hall.space_type.replace(/_/g, ' ').toLowerCase()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onSwitch(hall)}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                  >
                    Switch
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
