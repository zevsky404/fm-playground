import { useCallback } from 'react';
import { getEdgesByRelationship } from './graphUtils';

interface UseGraphInteractionsOptions {
    onRelationshipHover?: (relationship: string | null) => void;
}

/**
 * Hook to set up graph interaction handlers.
 */
export const useGraphInteractions = (options: UseGraphInteractionsOptions = {}) => {
    const { onRelationshipHover } = options;

    const setupInteractions = useCallback((cy: cytoscape.Core) => {
        // Clear any existing handlers
        cy.removeAllListeners();

        // Highlight on node hover
        cy.on('mouseover', 'node', (e) => {
            const node = e.target;
            const connectedEdges = node.connectedEdges();
            const connectedNodes = connectedEdges.connectedNodes();

            cy.elements().addClass('dimmed');
            node.removeClass('dimmed').addClass('highlighted');
            connectedEdges.removeClass('dimmed').addClass('highlighted');
            connectedNodes.removeClass('dimmed').addClass('highlighted');
        });

        cy.on('mouseout', 'node', () => {
            cy.elements().removeClass('dimmed highlighted');
        });

        // Highlight on edge hover
        cy.on('mouseover', 'edge', (e) => {
            const edge = e.target;
            const connectedNodes = edge.connectedNodes();

            cy.elements().addClass('dimmed');
            edge.removeClass('dimmed').addClass('highlighted');
            connectedNodes.removeClass('dimmed').addClass('highlighted');
        });

        cy.on('mouseout', 'edge', () => {
            cy.elements().removeClass('dimmed highlighted');
        });
    }, []);

    /**
     * Highlight all edges of a specific relationship type.
     */
    const highlightRelationship = useCallback(
        (cy: cytoscape.Core, relationship: string) => {
            const edges = getEdgesByRelationship(cy, relationship);
            const connectedNodes = edges.connectedNodes();

            cy.elements().addClass('dimmed');
            edges.removeClass('dimmed').addClass('highlighted');
            connectedNodes.removeClass('dimmed').addClass('highlighted');

            onRelationshipHover?.(relationship);
        },
        [onRelationshipHover]
    );

    /**
     * Clear all highlights.
     */
    const clearHighlights = useCallback(
        (cy: cytoscape.Core) => {
            cy.elements().removeClass('dimmed highlighted');
            onRelationshipHover?.(null);
        },
        [onRelationshipHover]
    );

    return {
        setupInteractions,
        highlightRelationship,
        clearHighlights,
    };
};
