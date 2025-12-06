import React, { useState, useRef, useEffect, useCallback } from 'react';

// Preset colors for quick selection
const PRESET_COLORS = [
    '#E8C547', // Yellow (default)
    '#F44336', // Red
    '#E91E63', // Pink
    '#9C27B0', // Purple
    '#673AB7', // Deep Purple
    '#3F51B5', // Indigo
    '#2196F3', // Blue
    '#03A9F4', // Light Blue
    '#00BCD4', // Cyan
    '#009688', // Teal
    '#4CAF50', // Green
    '#8BC34A', // Light Green
    '#CDDC39', // Lime
    '#FFEB3B', // Yellow
    '#FFC107', // Amber
    '#FF9800', // Orange
    '#FF5722', // Deep Orange
    '#795548', // Brown
    '#9E9E9E', // Grey
    '#607D8B', // Blue Grey
];

interface ColorPickerProps {
    currentColor: string;
    onColorChange: (color: string) => void;
    onClose: () => void;
    position: { x: number; y: number };
}

const ColorPicker: React.FC<ColorPickerProps> = ({
    currentColor,
    onColorChange,
    onClose,
    position,
}) => {
    const [customColor, setCustomColor] = useState(currentColor);
    const pickerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    const handlePresetClick = useCallback((color: string) => {
        onColorChange(color);
        onClose();
    }, [onColorChange, onClose]);

    const handleCustomColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const color = e.target.value;
        setCustomColor(color);
    }, []);

    const handleCustomColorApply = useCallback(() => {
        onColorChange(customColor);
        onClose();
    }, [customColor, onColorChange, onClose]);

    return (
        <div
            ref={pickerRef}
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                backgroundColor: '#ffffff',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                padding: 12,
                zIndex: 1001,
                width: 220,
            }}
        >
            <div
                style={{
                    fontWeight: 'bold',
                    fontSize: 12,
                    color: '#666',
                    marginBottom: 10,
                    textTransform: 'uppercase',
                }}
            >
                Choose Color
            </div>

            {/* Preset Colors Grid */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: 6,
                    marginBottom: 12,
                }}
            >
                {PRESET_COLORS.map((color) => (
                    <div
                        key={color}
                        onClick={() => handlePresetClick(color)}
                        style={{
                            width: 32,
                            height: 32,
                            backgroundColor: color,
                            borderRadius: 4,
                            cursor: 'pointer',
                            border: currentColor === color ? '3px solid #333' : '1px solid #ddd',
                            transition: 'transform 0.1s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    />
                ))}
            </div>

            {/* Divider */}
            <div
                style={{
                    height: 1,
                    backgroundColor: '#e0e0e0',
                    margin: '12px 0',
                }}
            />

            {/* Custom Color Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                    ref={inputRef}
                    type="color"
                    value={customColor}
                    onChange={handleCustomColorChange}
                    style={{
                        width: 40,
                        height: 32,
                        padding: 0,
                        border: '1px solid #ddd',
                        borderRadius: 4,
                        cursor: 'pointer',
                    }}
                />
                <input
                    type="text"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '6px 8px',
                        border: '1px solid #ddd',
                        borderRadius: 4,
                        fontSize: 12,
                        fontFamily: 'monospace',
                    }}
                    placeholder="#RRGGBB"
                />
                <button
                    onClick={handleCustomColorApply}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#4A90D9',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 'bold',
                    }}
                >
                    Apply
                </button>
            </div>
        </div>
    );
};

export default ColorPicker;
