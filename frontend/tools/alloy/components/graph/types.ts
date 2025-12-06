export interface GraphElement {
    data: {
        id: string;
        label?: string;
        source?: string;
        target?: string;
        relationship?: string;
        nodeType?: string;
    };
}

export interface LegendItem {
    relationship: string;
    label: string;
    color: string;
    count: number;
}

export interface RelationshipStats {
    relationship: string;
    count: number;
}

/**
 * Custom colors for nodes and relationships.
 */
export interface CustomColors {
    nodes?: Map<string, string>;        // nodeId -> color
    nodeTypes?: Map<string, string>;    // nodeType -> color
    relationships?: Map<string, string>; // relationship -> color
}

/**
 * Context menu item types.
 */
export type ContextMenuTargetType = 'node' | 'edge' | 'canvas';

export interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    targetType: ContextMenuTargetType;
    targetId: string | null;
    targetLabel: string | null;
    targetRelationship: string | null;
    targetNodeType: string | null;
}
