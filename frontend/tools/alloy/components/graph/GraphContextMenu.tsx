import React, { useRef, useEffect } from 'react';
import { ContextMenuState } from './types';

export interface ContextMenuItem {
    label: string;
    icon?: string;
    onClick: () => void;
    divider?: boolean;
    disabled?: boolean;
}

interface GraphContextMenuProps {
    state: ContextMenuState;
    onClose: () => void;
    items: ContextMenuItem[];
}

const GraphContextMenu: React.FC<GraphContextMenuProps> = ({ state, onClose, items }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (state.visible) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [state.visible, onClose]);

    if (!state.visible || items.length === 0) {
        return null;
    }

    // Filter out consecutive dividers and dividers at start/end
    const filteredItems = items.filter((item, index, arr) => {
        if (!item.divider) return true;
        if (index === 0 || index === arr.length - 1) return false;
        if (arr[index - 1]?.divider) return false;
        return true;
    });

    return (
        <div
            ref={menuRef}
            style={{
                position: 'fixed',
                left: state.x,
                top: state.y,
                backgroundColor: '#ffffff',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                padding: 4,
                zIndex: 1000,
                minWidth: 180,
                maxWidth: 280,
            }}
        >
            {filteredItems.map((item, index) => {
                if (item.divider) {
                    return (
                        <div
                            key={`divider-${index}`}
                            style={{
                                height: 1,
                                backgroundColor: '#e0e0e0',
                                margin: '4px 8px',
                            }}
                        />
                    );
                }

                return (
                    <div
                        key={`item-${index}`}
                        onClick={() => {
                            if (!item.disabled) {
                                item.onClick();
                                onClose();
                            }
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            cursor: item.disabled ? 'not-allowed' : 'pointer',
                            borderRadius: 4,
                            fontSize: 13,
                            color: item.disabled ? '#999' : '#333',
                            backgroundColor: 'transparent',
                            transition: 'background-color 0.15s ease',
                            opacity: item.disabled ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => {
                            if (!item.disabled) {
                                e.currentTarget.style.backgroundColor = '#f5f5f5';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        {item.icon && <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{item.icon}</span>}
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default GraphContextMenu;
