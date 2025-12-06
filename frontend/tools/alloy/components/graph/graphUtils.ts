import { GraphElement, LegendItem, RelationshipStats } from './types';
import { buildRelationshipColorMap } from './colorUtils';

/**
 * Extract clean label from relationship string (removes type IDs).
 */
export const getCleanLabel = (relationship: string): string => {
    const match = relationship.match(/^([^(]+)/);
    return match ? match[1].trim() : relationship;
};

/**
 * Get unique relationships from graph elements.
 */
export const getUniqueRelationships = (elements: GraphElement[]): string[] => {
    return [
        ...new Set(
            elements
                .filter((element) => element.data.relationship)
                .map((element) => element.data.relationship as string)
        ),
    ];
};

/**
 * Count edges per relationship type.
 */
export const getRelationshipStats = (elements: GraphElement[]): RelationshipStats[] => {
    const counts = new Map<string, number>();
    
    elements.forEach((element) => {
        const rel = element.data.relationship;
        if (rel) {
            counts.set(rel, (counts.get(rel) || 0) + 1);
        }
    });

    return Array.from(counts.entries()).map(([relationship, count]) => ({
        relationship,
        count,
    }));
};

/**
 * Build legend items with colors and counts.
 */
export const buildLegendItems = (elements: GraphElement[]): LegendItem[] => {
    const stats = getRelationshipStats(elements);
    const relationships = stats.map((s) => s.relationship);
    const colorMap = buildRelationshipColorMap(relationships);

    return stats.map((stat) => ({
        relationship: stat.relationship,
        label: getCleanLabel(stat.relationship),
        color: colorMap.get(stat.relationship) || '#888888',
        count: stat.count,
    }));
};

/**
 * Get edges that match a specific relationship.
 */
export const getEdgesByRelationship = (
    cy: cytoscape.Core,
    relationship: string
): cytoscape.EdgeCollection => {
    return cy.edges(`[relationship="${relationship}"]`);
};
