/**
 * Combines block name + location details into the legacy `location` string
 * stored on Space records (non-destructive; no schema changes).
 */
export function combineSpaceLocation(blockName, locationDetails) {
  const block = (blockName || "").trim()
  const details = (locationDetails || "").trim()
  if (block && details) return `${block} - ${details}`
  if (block) return block
  return details
}

/**
 * Parses a stored `location` string back into block + details for admin UI.
 * Prefers matching against known blocks from GET /spaces/blocks/.
 */
export function parseSpaceLocation(location, blocks = []) {
  const loc = (location || "").trim()
  if (!loc) return { blockId: "", blockName: "", locationDetails: "" }

  const sorted = [...blocks].sort(
    (a, b) => (b.name?.length || 0) - (a.name?.length || 0)
  )
  for (const block of sorted) {
    if (!block?.name) continue
    const prefix = `${block.name} - `
    if (loc.startsWith(prefix)) {
      return {
        blockId: String(block.id),
        blockName: block.name,
        locationDetails: loc.slice(prefix.length).trim(),
      }
    }
    if (loc === block.name) {
      return { blockId: String(block.id), blockName: block.name, locationDetails: "" }
    }
  }

  const sep = loc.indexOf(" - ")
  if (sep > 0) {
    const blockName = loc.slice(0, sep).trim()
    const matched = blocks.find((b) => b.name === blockName)
    return {
      blockId: matched ? String(matched.id) : "",
      blockName,
      locationDetails: loc.slice(sep + 3).trim(),
    }
  }

  return { blockId: "", blockName: "", locationDetails: loc }
}
