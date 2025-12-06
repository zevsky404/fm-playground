// Curated color palette for better visual distinction
const COLOR_PALETTE = [
    '#2196F3', // Blue
    '#4CAF50', // Green
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#F44336', // Red
    '#00BCD4', // Cyan
    '#E91E63', // Pink
    '#795548', // Brown
    '#607D8B', // Blue Grey
    '#8BC34A', // Light Green
    '#FF5722', // Deep Orange
    '#3F51B5', // Indigo
];

/**
 * Generate a color based on a string hash.
 * Used as fallback when we exceed the curated palette.
 */
const generateColorFromHash = (str: string): string => {
    const hashCode = (s: string): number => {
        let hash = 0;
        for (let i = 0; i < s.length; i++) {
            const char = s.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    };

    const hash = hashCode(str);
    
    // Generate HSL color for better distribution
    // Use golden ratio for hue distribution
    const hue = (hash * 137.508) % 360;
    const saturation = 65 + (hash % 20); // 65-85%
    const lightness = 45 + (hash % 15);  // 45-60%
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * Get color for a relationship.
 * Uses curated palette first, falls back to generated colors.
 */
export const getColorForRelationship = (relationship: string, index: number): string => {
    if (index < COLOR_PALETTE.length) {
        return COLOR_PALETTE[index];
    }
    // Fallback to generated color for additional relationships
    return generateColorFromHash(relationship);
};

/**
 * Build a color map for all relationships.
 */
export const buildRelationshipColorMap = (relationships: string[]): Map<string, string> => {
    const colorMap = new Map<string, string>();
    relationships.forEach((rel, index) => {
        colorMap.set(rel, getColorForRelationship(rel, index));
    });
    return colorMap;
};

/**
 * Get CSS variable value from document.
 */
export const getCssVariable = (variable: string): string => {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
};
