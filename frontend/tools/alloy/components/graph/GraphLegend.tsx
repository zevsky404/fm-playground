import React, { useState, useEffect } from 'react';
import { LegendItem } from './types';

const LEGEND_COLLAPSED_KEY = 'alloy-graph-legend-collapsed';

interface GraphLegendProps {
    items: LegendItem[];
    onItemHover: (relationship: string) => void;
    onItemLeave: () => void;
    activeRelationship?: string | null;
}

const GraphLegend: React.FC<GraphLegendProps> = ({
    items,
    onItemHover,
    onItemLeave,
    activeRelationship,
}) => {
    const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
        const saved = localStorage.getItem(LEGEND_COLLAPSED_KEY);
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem(LEGEND_COLLAPSED_KEY, String(isCollapsed));
    }, [isCollapsed]);

    if (items.length === 0) {
        return null;
    }

    const toggleCollapse = () => {
        setIsCollapsed((prev) => !prev);
    };

    return (
        <div
            style={{
                position: 'absolute',
                top: 10,
                right: 10,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: 8,
                padding: '10px 14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                fontSize: 12,
                maxWidth: 220,
                zIndex: 10,
                userSelect: 'none',
            }}
        >
            <div
                onClick={toggleCollapse}
                style={{
                    fontWeight: 'bold',
                    marginBottom: isCollapsed ? 0 : 8,
                    color: '#333',
                    borderBottom: isCollapsed ? 'none' : '1px solid #eee',
                    paddingBottom: isCollapsed ? 0 : 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <span>Relations</span>
                <span
                    style={{
                        fontSize: 10,
                        color: '#888',
                        marginLeft: 8,
                        transition: 'transform 0.2s ease',
                        display: 'inline-block',
                        transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    }}
                >
                    ▼
                </span>
            </div>
            {!isCollapsed && (
                <div>
                    {items.map((item) => {
                        const isActive = activeRelationship === item.relationship;
                        return (
                            <div
                                key={item.relationship}
                                onMouseEnter={() => onItemHover(item.relationship)}
                                onMouseLeave={onItemLeave}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 6,
                                    padding: '4px 6px',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    backgroundColor: isActive ? 'rgba(0,0,0,0.08)' : 'transparent',
                                    transition: 'background-color 0.15s ease',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div
                                        style={{
                                            width: 24,
                                            height: 4,
                                            backgroundColor: item.color,
                                            marginRight: 8,
                                            borderRadius: 2,
                                        }}
                                    />
                                    <span style={{ color: '#555' }}>{item.label}</span>
                                </div>
                                <span
                                    style={{
                                        backgroundColor: item.color,
                                        color: '#fff',
                                        fontSize: 10,
                                        fontWeight: 'bold',
                                        padding: '2px 6px',
                                        borderRadius: 10,
                                        minWidth: 20,
                                        textAlign: 'center',
                                    }}
                                >
                                    {item.count}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default GraphLegend;
