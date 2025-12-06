import React, { useEffect, useRef, useState } from 'react';
import * as vscode from 'vscode';
import { createModelReference } from 'vscode/monaco';
import { MonacoEditorLanguageClientWrapper } from 'monaco-editor-wrapper';
import { createDynamicLspConfig } from '@/../tools/common/dynamicLspWrapperConfig';
import '../../assets/style/Playground.css';
import '@codingame/monaco-vscode-theme-defaults-default-extension';
import type { LanguageProps } from './Tools';
import { fmpConfig } from '@/ToolMaps';
import * as monaco from 'monaco-editor';
import { useAtom } from 'jotai';
import {
    cursorLineAtom,
    cursorColumnAtom,
    greenHighlightAtom,
    selectedTextAtom,
    selectionRangeAtom,
    targetAssertionRangeAtom,
    minimalSetRangesAtom,
    jotaiStore,
} from '@/atoms';
import Editor from './Editor'; // Fallback editor

type LspEditorProps = {
    height: string;
    setEditorValue: (value: string) => void;
    editorValue: string;
    language: LanguageProps;
    setLanguage?: (value: string) => void;
    lineToHighlight: number[];
    setLineToHighlight: (line: number[]) => void;
    editorTheme?: string;
};

// Create wrapper instance only when needed
let wrapperInstance: MonacoEditorLanguageClientWrapper | null = null;

const LspEditor: React.FC<LspEditorProps> = (props) => {
    const editorRef = useRef<any>(null);
    const prevLanguageRef = useRef<LanguageProps | null>(null);
    const isInitializedRef = useRef<boolean>(false);
    const [lspFailed, setLspFailed] = useState<boolean>(false); // Track LSP initialization failure
    const cursorListenerRef = useRef<any>(null); // Store cursor listener disposable
    const [decorationIds, setDecorationIds] = useState<string[]>([]);
    const [greenDecorationIds, setGreenDecorationIds] = useState<string[]>([]);
    const [rangeDecorationIds, setRangeDecorationIds] = useState<string[]>([]);
    const [greenHighlight, setGreenHighlight] = useAtom(greenHighlightAtom);
    const [, setCursorLine] = useAtom(cursorLineAtom);
    const [, setCursorColumn] = useAtom(cursorColumnAtom);
    const [, setSelectedText] = useAtom(selectedTextAtom);
    const [, setSelectionRange] = useAtom(selectionRangeAtom);
    const [targetAssertionRange] = useAtom(targetAssertionRangeAtom);
    const [minimalSetRanges] = useAtom(minimalSetRangesAtom);

    const getExtensionById = (id: string): string | undefined => {
        const tool = Object.values(fmpConfig.tools).find((tool) => tool.extension.toLowerCase() === id.toLowerCase());
        return tool?.extension;
    };
    const handleCodeChange = (value: string) => {
        props.setEditorValue(value);
        props.setLineToHighlight([]);
        setGreenHighlight([]);
        // Clear range-based highlights
        jotaiStore.set(targetAssertionRangeAtom, null);
        jotaiStore.set(minimalSetRangesAtom, []);
    };

    useEffect(() => {
        // Don't initialize if language is not set yet
        if (!props.language?.id) {
            return;
        }

        // Initialize wrapper if not already done
        if (!wrapperInstance) {
            wrapperInstance = new MonacoEditorLanguageClientWrapper();
        }

        const startEditor = async () => {
            if (wrapperInstance?.isStarted()) {
                console.warn('Editor already started, disposing first...');
                await wrapperInstance.dispose();
                isInitializedRef.current = false;
            }

            if (!isInitializedRef.current) {
                try {
                    const langiumGlobalConfig = await createDynamicLspConfig(props.language.short);

                    if (!langiumGlobalConfig) {
                        console.warn(`LSP not available for ${props.language.short}, falling back to basic editor`);
                        setLspFailed(true);
                        return;
                    }

                    await wrapperInstance!.initAndStart(
                        langiumGlobalConfig,
                        document.getElementById('monaco-editor-root')
                    );

                    const currentExtension = getExtensionById(props.language?.id ?? '');
                    const uri = vscode.Uri.parse(`/workspace/example.${currentExtension}`);
                    const modelRef = await createModelReference(uri, props.editorValue);
                    wrapperInstance!.updateEditorModels({
                        modelRef,
                    });

                    editorRef.current = wrapperInstance!.getEditor();
                    setLspFailed(false); // LSP initialized successfully

                    // Dispose old cursor listener if exists
                    if (cursorListenerRef.current) {
                        cursorListenerRef.current.dispose();
                    }

                    // Track cursor position changes
                    cursorListenerRef.current = editorRef.current.onDidChangeCursorPosition((e: any) => {
                        const lineNumber = e.position.lineNumber;
                        const column = e.position.column;
                        setCursorLine(lineNumber);
                        setCursorColumn(column);
                    });

                    // Track selection changes
                    editorRef.current.onDidChangeCursorSelection((e: any) => {
                        const model = editorRef.current.getModel();
                        if (model) {
                            const selection = e.selection;
                            const selectedText = model.getValueInRange(selection);
                            setSelectedText(selectedText);

                            // Store the selection range
                            setSelectionRange({
                                startLine: selection.startLineNumber,
                                startColumn: selection.startColumn,
                                endLine: selection.endLineNumber,
                                endColumn: selection.endColumn,
                            });
                        }
                    });

                    editorRef.current.onDidChangeModelContent(() => {
                        handleCodeChange(editorRef.current.getValue());
                    });

                    const code = localStorage.getItem('editorValue');
                    if (code) {
                        editorRef.current.setValue(code);
                    } else {
                        editorRef.current.setValue(props.editorValue);
                    }

                    // Initialize cursor position AFTER setting value (setValue resets cursor to line 1)
                    const currentPosition = editorRef.current.getPosition();
                    if (currentPosition) {
                        setCursorLine(currentPosition.lineNumber);
                    }

                    isInitializedRef.current = true;
                    prevLanguageRef.current = props.language;
                } catch (error) {
                    console.error('Error initializing LSP editor, falling back to basic editor:', error);
                    setLspFailed(true);
                    // Clean up failed LSP instance
                    if (wrapperInstance?.isStarted()) {
                        await wrapperInstance.dispose();
                    }
                    wrapperInstance = null;
                    isInitializedRef.current = false;
                }
            }
        };

        startEditor();

        return () => {
            // Clean up cursor listener
            if (cursorListenerRef.current) {
                cursorListenerRef.current.dispose();
                cursorListenerRef.current = null;
            }

            // Clean up on unmount
            if (wrapperInstance?.isStarted()) {
                wrapperInstance.dispose();
                wrapperInstance = null;
                isInitializedRef.current = false;
            }
        };
    }, [props.language?.id]); // Only depend on language ID for initialization

    useEffect(() => {
        // Only update if editor is initialized and language has changed
        if (!isInitializedRef.current || !editorRef.current || !props.language?.id || !wrapperInstance) {
            return;
        }

        // Check if language actually changed
        if (prevLanguageRef.current?.id === props.language.id) {
            return;
        }

        // Update the code resources for the new language
        wrapperInstance.updateCodeResources({
            main: {
                text: props.editorValue,
                fileExt: getExtensionById(props.language.id) ?? '',
            },
        });

        // Update the model reference with new language extension
        const updateModel = async () => {
            console.log('[LspEditor] Updating model for language:', props.language.id);
            const currentExtension = getExtensionById(props.language.id);
            const uri = vscode.Uri.parse(`/workspace/example.${currentExtension}`);
            const modelRef = await createModelReference(uri, props.editorValue);
            wrapperInstance!.updateEditorModels({
                modelRef,
            });

            // Re-establish cursor tracking after model update
            editorRef.current = wrapperInstance!.getEditor();

            // Dispose old cursor listener if exists
            if (cursorListenerRef.current) {
                cursorListenerRef.current.dispose();
            }

            // Track cursor position changes
            cursorListenerRef.current = editorRef.current.onDidChangeCursorPosition((e: any) => {
                const lineNumber = e.position.lineNumber;
                const column = e.position.column;
                setCursorLine(lineNumber);
                setCursorColumn(column);
            });

            // Track selection changes
            editorRef.current.onDidChangeCursorSelection((e: any) => {
                const model = editorRef.current.getModel();
                if (model) {
                    const selection = e.selection;
                    const selectedText = model.getValueInRange(selection);
                    setSelectedText(selectedText);

                    // Store the selection range
                    setSelectionRange({
                        startLine: selection.startLineNumber,
                        startColumn: selection.startColumn,
                        endLine: selection.endLineNumber,
                        endColumn: selection.endColumn,
                    });
                }
            });

            // Initialize cursor position to current position
            const currentPosition = editorRef.current.getPosition();
            if (currentPosition) {
                setCursorLine(currentPosition.lineNumber);
            }
        };

        updateModel();
        prevLanguageRef.current = props.language;
    }, [props.language?.id]);
    useEffect(() => {
        if (isInitializedRef.current && editorRef.current) {
            setEditorValue(props.editorValue);
        }
    }, [props.editorValue]);

    // Line highlighting effect - similar to Editor.tsx
    useEffect(() => {
        if (editorRef.current) {
            const editor = editorRef.current;
            if (props.lineToHighlight !== null && props.lineToHighlight.length > 0) {
                const decorations = props.lineToHighlight.map((line) => {
                    return {
                        range: new monaco.Range(line, 1, line, 1),
                        options: {
                            isWholeLine: true,
                            className: 'lineHighlight',
                            glyphMarginClassName: 'lineHighlightGlyph',
                        },
                    };
                });
                const newDecorationIds = editor.deltaDecorations(decorationIds, decorations);
                setDecorationIds(newDecorationIds);
            } else {
                // Remove all decorations
                const newDecorationIds = editor.deltaDecorations(decorationIds, []);
                setDecorationIds(newDecorationIds);
            }
        }
    }, [props.lineToHighlight]);

    // Green highlighting for explain redundancy
    useEffect(() => {
        if (editorRef.current) {
            const editor = editorRef.current;
            if (greenHighlight !== null && greenHighlight.length > 0) {
                const decorations = greenHighlight.map((line) => {
                    return {
                        range: new monaco.Range(line, 1, line, 1),
                        options: {
                            isWholeLine: true,
                            className: 'lineHighlightGreen',
                            glyphMarginClassName: 'lineHighlightGlyphGreen',
                        },
                    };
                });
                const newGreenDecorationIds = editor.deltaDecorations(greenDecorationIds, decorations);
                setGreenDecorationIds(newGreenDecorationIds);
            } else {
                // Remove all green decorations
                const newGreenDecorationIds = editor.deltaDecorations(greenDecorationIds, []);
                setGreenDecorationIds(newGreenDecorationIds);
            }
        }
    }, [greenHighlight]);

    // Range-based highlighting for precise assertion ranges
    useEffect(() => {
        if (editorRef.current) {
            const editor = editorRef.current;
            const decorations: any[] = [];

            // Add target assertion range decoration (yellow)
            if (targetAssertionRange) {
                decorations.push({
                    range: new monaco.Range(
                        targetAssertionRange.startLine,
                        targetAssertionRange.startColumn,
                        targetAssertionRange.endLine,
                        targetAssertionRange.endColumn
                    ),
                    options: {
                        inlineClassName: 'inlineHighlightYellow',
                        className: 'rangeHighlightYellow',
                    },
                });
            }

            // Add minimal set ranges decorations (green)
            if (minimalSetRanges && minimalSetRanges.length > 0) {
                minimalSetRanges.forEach((range) => {
                    decorations.push({
                        range: new monaco.Range(range.startLine, range.startColumn, range.endLine, range.endColumn),
                        options: {
                            inlineClassName: 'inlineHighlightGreen',
                            className: 'rangeHighlightGreen',
                        },
                    });
                });
            }

            const newRangeDecorationIds = editor.deltaDecorations(rangeDecorationIds, decorations);
            setRangeDecorationIds(newRangeDecorationIds);
        }
    }, [targetAssertionRange, minimalSetRanges]);

    const setEditorValue = (value: string) => {
        if (editorRef.current) {
            const currentValue = editorRef.current.getValue();
            if (currentValue !== value) {
                const selection = editorRef.current.getSelection();
                editorRef.current.setValue(value);
                if (selection) {
                    editorRef.current.setSelection(selection);
                }
            }
        }
    };

    // If LSP failed, fall back to basic editor
    if (lspFailed) {
        return <Editor height={props.height} editorTheme={props.editorTheme || 'vs-dark'} />;
    }

    return (
        <div className='custom-code-editor'>
            <div id='monaco-editor-root' style={{ height: props.height }} />
        </div>
    );
};

export default LspEditor;
