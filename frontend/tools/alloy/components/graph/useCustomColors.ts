import { useState, useCallback } from 'react';
import { CustomColors } from './types';

const CUSTOM_COLORS_KEY = 'alloy-graph-custom-colors';

interface StoredCustomColors {
    nodes: [string, string][];
    nodeTypes: [string, string][];
    relationships: [string, string][];
}

/**
 * Hook to manage custom colors for graph elements with persistence.
 */
export const useCustomColors = () => {
    const [customColors, setCustomColors] = useState<CustomColors>(() => {
        try {
            const saved = localStorage.getItem(CUSTOM_COLORS_KEY);
            if (saved) {
                const parsed: StoredCustomColors = JSON.parse(saved);
                return {
                    nodes: new Map(parsed.nodes || []),
                    nodeTypes: new Map(parsed.nodeTypes || []),
                    relationships: new Map(parsed.relationships || []),
                };
            }
        } catch (e) {
            console.warn('Failed to load custom colors from localStorage', e);
        }
        return {
            nodes: new Map(),
            nodeTypes: new Map(),
            relationships: new Map(),
        };
    });

    const saveToStorage = useCallback((colors: CustomColors) => {
        try {
            const toStore: StoredCustomColors = {
                nodes: Array.from(colors.nodes?.entries() || []),
                nodeTypes: Array.from(colors.nodeTypes?.entries() || []),
                relationships: Array.from(colors.relationships?.entries() || []),
            };
            localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(toStore));
        } catch (e) {
            console.warn('Failed to save custom colors to localStorage', e);
        }
    }, []);

    const setNodeColor = useCallback(
        (nodeId: string, color: string) => {
            setCustomColors((prev) => {
                const newNodes = new Map(prev.nodes || []);
                newNodes.set(nodeId, color);
                const newColors: CustomColors = {
                    nodes: newNodes,
                    nodeTypes: prev.nodeTypes || new Map(),
                    relationships: prev.relationships || new Map(),
                };
                saveToStorage(newColors);
                return newColors;
            });
        },
        [saveToStorage]
    );

    const setNodeTypeColor = useCallback(
        (nodeType: string, color: string) => {
            setCustomColors((prev) => {
                const newNodeTypes = new Map(prev.nodeTypes || []);
                newNodeTypes.set(nodeType, color);
                const newColors: CustomColors = {
                    nodes: prev.nodes || new Map(),
                    nodeTypes: newNodeTypes,
                    relationships: prev.relationships || new Map(),
                };
                saveToStorage(newColors);
                return newColors;
            });
        },
        [saveToStorage]
    );

    const setRelationshipColor = useCallback(
        (relationship: string, color: string) => {
            setCustomColors((prev) => {
                const newRelationships = new Map(prev.relationships || []);
                newRelationships.set(relationship, color);
                const newColors: CustomColors = {
                    nodes: prev.nodes || new Map(),
                    nodeTypes: prev.nodeTypes || new Map(),
                    relationships: newRelationships,
                };
                saveToStorage(newColors);
                return newColors;
            });
        },
        [saveToStorage]
    );

    const resetNodeColor = useCallback(
        (nodeId: string) => {
            setCustomColors((prev) => {
                const newNodes = new Map(prev.nodes || []);
                newNodes.delete(nodeId);
                const newColors: CustomColors = {
                    nodes: newNodes,
                    nodeTypes: prev.nodeTypes || new Map(),
                    relationships: prev.relationships || new Map(),
                };
                saveToStorage(newColors);
                return newColors;
            });
        },
        [saveToStorage]
    );

    const resetNodeTypeColor = useCallback(
        (nodeType: string) => {
            setCustomColors((prev) => {
                const newNodeTypes = new Map(prev.nodeTypes || []);
                newNodeTypes.delete(nodeType);
                const newColors: CustomColors = {
                    nodes: prev.nodes || new Map(),
                    nodeTypes: newNodeTypes,
                    relationships: prev.relationships || new Map(),
                };
                saveToStorage(newColors);
                return newColors;
            });
        },
        [saveToStorage]
    );

    const resetRelationshipColor = useCallback(
        (relationship: string) => {
            setCustomColors((prev) => {
                const newRelationships = new Map(prev.relationships || []);
                newRelationships.delete(relationship);
                const newColors: CustomColors = {
                    nodes: prev.nodes || new Map(),
                    nodeTypes: prev.nodeTypes || new Map(),
                    relationships: newRelationships,
                };
                saveToStorage(newColors);
                return newColors;
            });
        },
        [saveToStorage]
    );

    const resetAllColors = useCallback(() => {
        const emptyColors: CustomColors = {
            nodes: new Map(),
            nodeTypes: new Map(),
            relationships: new Map(),
        };
        setCustomColors(emptyColors);
        localStorage.removeItem(CUSTOM_COLORS_KEY);
    }, []);

    const getNodeColor = useCallback(
        (nodeId: string, nodeType?: string): string | undefined => {
            // Check individual node color first
            if (customColors.nodes?.has(nodeId)) {
                return customColors.nodes.get(nodeId);
            }
            // Then check node type color
            if (nodeType && customColors.nodeTypes?.has(nodeType)) {
                return customColors.nodeTypes.get(nodeType);
            }
            return undefined;
        },
        [customColors]
    );

    const getRelationshipColor = useCallback(
        (relationship: string): string | undefined => {
            return customColors.relationships?.get(relationship);
        },
        [customColors]
    );

    return {
        customColors,
        setNodeColor,
        setNodeTypeColor,
        setRelationshipColor,
        resetNodeColor,
        resetNodeTypeColor,
        resetRelationshipColor,
        resetAllColors,
        getNodeColor,
        getRelationshipColor,
    };
};
