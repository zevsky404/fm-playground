/**
 * Extract the type name from a node ID.
 * Examples:
 *   "Alice0" -> "Alice"
 *   "Bob0" -> "Bob"
 *   "LightB0" -> "LightB"
 *   "State1" -> "State"
 *   "Alice" -> "Alice" (no number suffix)
 */
export const extractNodeType = (nodeId: string): string => {
    // Match everything except trailing digits
    const match = nodeId.match(/^(.+?)(\d*)$/);
    if (match && match[1]) {
        return match[1];
    }
    return nodeId;
};

/**
 * Get all unique node types from a list of node IDs.
 */
export const getUniqueNodeTypes = (nodeIds: string[]): string[] => {
    const types = new Set<string>();
    nodeIds.forEach((id) => {
        types.add(extractNodeType(id));
    });
    return Array.from(types);
};
