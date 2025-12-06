import cytoscape from 'cytoscape';
import { getColorForRelationship } from './colorUtils';
import { CustomColors } from './types';

// Default node color - yellowish like Alloy Analyzer
export const DEFAULT_NODE_COLOR = '#E8C547';
export const DEFAULT_NODE_BORDER_COLOR = '#C4A535';
export const DEFAULT_NODE_HOVER_COLOR = '#D4B33D';
export const DEFAULT_NODE_SELECTED_BORDER_COLOR = '#FF9800';
export const DEFAULT_NODE_HIGHLIGHTED_COLOR = '#F0D060';

/**
 * Generate Cytoscape stylesheet for the graph.
 */
export const createCytoscapeStylesheet = (
    uniqueRelationships: string[],
    customColors?: CustomColors
): cytoscape.StylesheetStyle[] => {
    const styles: any[] = [
        // Node base styles
        {
            selector: 'node',
            style: {
                width: 120,
                height: 45,
                'background-color': DEFAULT_NODE_COLOR,
                'background-opacity': 0.95,
                shape: 'roundrectangle',
                'text-valign': 'center',
                'text-halign': 'center',
                'text-wrap': 'wrap',
                'text-max-width': '100px',
                label: 'data(label)',
                color: '#333333', 
                'font-size': 14,
                'font-weight': 'bold',
                'border-width': 1,
                'border-color': DEFAULT_NODE_BORDER_COLOR,
                'border-opacity': 0.8,
                'text-outline-width': 0,
                'transition-property': 'background-color, border-color, border-width, background-opacity',
                'transition-duration': '0.2s',
            },
        },
        // Node hover state
        {
            selector: 'node:active',
            style: {
                'background-color': DEFAULT_NODE_HOVER_COLOR,
                'border-width': 1,
                'border-color': DEFAULT_NODE_BORDER_COLOR,
            },
        },
        // Node selected state
        {
            selector: 'node:selected',
            style: {
                'background-color': DEFAULT_NODE_HOVER_COLOR,
                'border-width': 1,
                'border-color': DEFAULT_NODE_SELECTED_BORDER_COLOR,
            },
        },
        // Highlighted nodes (connected to hovered element)
        {
            selector: 'node.highlighted',
            style: {
                'background-color': DEFAULT_NODE_HIGHLIGHTED_COLOR,
                'border-width': 1,
                'border-color': DEFAULT_NODE_SELECTED_BORDER_COLOR,
            },
        },
        // Dimmed nodes (not connected to hovered element)
        {
            selector: 'node.dimmed',
            style: {
                'background-opacity': 0.3,
                'border-opacity': 0.3,
            },
        },
        // Edge base styles
        {
            selector: 'edge',
            style: {
                width: 3,
                'line-color': '#888888',
                'target-arrow-color': '#888888',
                'target-arrow-shape': 'triangle',
                'arrow-scale': 1.2,
                'curve-style': 'bezier',
                'control-point-step-size': 40,
                label: 'data(label)',
                color: '#888888',
                'text-rotation': 'autorotate',
                'font-size': 14,
                'font-weight': 'bold',
                'text-margin-y': -10,
                'text-background-opacity': 0,
                'transition-property': 'line-color, target-arrow-color, width, opacity',
                'transition-duration': '0.2s',
            },
        },
        // Edge hover state
        {
            selector: 'edge:active',
            style: {
                width: 5,
            },
        },
        // Edge selected state
        {
            selector: 'edge:selected',
            style: {
                width: 5,
                'line-style': 'solid',
            },
        },
        // Highlighted edges
        {
            selector: 'edge.highlighted',
            style: {
                width: 5,
                'z-index': 999,
            },
        },
        // Dimmed edges
        {
            selector: 'edge.dimmed',
            style: {
                opacity: 0.2,
            },
        },
        // Self-loop edges (e.g., Alice trusts Alice)
        {
            selector: 'edge[source = target]',
            style: {
                'curve-style': 'bezier',
                'control-point-step-size': 80,
                'loop-direction': '-45deg',
                'loop-sweep': '90deg',
            },
        },
    ];

    // Add relationship-specific edge styles with distinct colors
    uniqueRelationships.forEach((relationship, index) => {
        const color = customColors?.relationships?.get(relationship) 
            || getColorForRelationship(relationship, index);
        styles.push({
            selector: `edge[relationship="${relationship}"]`,
            style: {
                'line-color': color,
                'target-arrow-color': color,
                color: color, // Label color matches edge color
            },
        });
    });

    // Add custom node type colors if specified (before individual node colors so they can be overridden)
    if (customColors?.nodeTypes) {
        customColors.nodeTypes.forEach((color, nodeType) => {
            styles.push({
                selector: `node[nodeType="${nodeType}"]`,
                style: {
                    'background-color': color,
                    'border-color': color,
                },
            });
        });
    }

    // Add custom node colors if specified (after node type colors so they take precedence)
    if (customColors?.nodes) {
        customColors.nodes.forEach((color, nodeId) => {
            styles.push({
                selector: `node[id="${nodeId}"]`,
                style: {
                    'background-color': color,
                    'border-color': color,
                },
            });
        });
    }

    return styles as cytoscape.StylesheetStyle[];
};

/**
 * Default layout options for the graph.
 */
export const defaultLayoutOptions = {
    name: 'breadthfirst',
    animate: true,
    animationDuration: 500,
    rankDir: 'TB',
    nodeSep: 50,
    rankSep: 100,
    edgeSep: 10,
    padding: 50,
};
