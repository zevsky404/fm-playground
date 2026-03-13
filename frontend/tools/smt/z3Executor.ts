import { explainRedundancy, parseLineRanges, parseRangesToMonaco } from '@/../tools/smt/explainRedundancy';
import { validateAssertion } from '@/../tools/smt/assertionValidator';
import { extractAssertion } from '@/../tools/smt/assertionParser';
import { checkRedundancy } from '@/../tools/smt/checkRedundancy';
import { getLineToHighlight } from '@/../tools/common/lineHighlightingUtil';
import { saveCodeAndRefreshHistory } from '@/utils/codeExecutionUtils';
import { fmpConfig } from '@/ToolMaps';
import { initiateModelIteration } from '@/../tools/smt/smtIterateModels';
import {
    editorValueAtom,
    jotaiStore,
    languageAtom,
    permalinkAtom,
    isExecutingAtom,
    lineToHighlightAtom,
    greenHighlightAtom,
    cursorLineAtom,
    cursorColumnAtom,
    selectedTextAtom,
    selectionRangeAtom,
    targetAssertionRangeAtom,
    minimalSetRangesAtom,
    outputAtom,
    enableLspAtom,
    smtCliOptionsAtom,
    smtModelAtom,
    hiddenFieldValueAtom,
    assignmentAssessmentReferenceSpecAtom,
} from '@/atoms';
import axios from 'axios';
import { Permalink } from '@/types';
import { logToDb } from '@/api/playgroundApi';

// let permalink = jotaiStore.get(permalinkAtom);
let __redundantLinesToRemove: any[] | null = null;
let __currentCheckOption: string = 'execute-z3'; // Track current check option for logging

// Helper to parse line data and return a set of line numbers
const parseLinesToSet = (linesData: any[], maxLines: number): Set<number> => {
    const lineSet = new Set<number>();
    const addRange = (start: number, end?: number) => {
        if (!Number.isFinite(start)) return;
        const s = Math.max(1, Math.min(Math.trunc(start), maxLines));
        const e = Number.isFinite(end as number) ? Math.max(1, Math.min(Math.trunc(end as number), maxLines)) : s;
        const from = Math.min(s, e);
        const to = Math.max(s, e);
        for (let i = from; i <= to; i++) lineSet.add(i);
    };

    if (Array.isArray(linesData)) {
        for (const item of linesData) {
            if (typeof item === 'number') {
                addRange(item);
            } else if (Array.isArray(item) && item.length >= 2) {
                addRange(Number(item[0]), Number(item[1]));
            } else if (item && typeof item === 'object') {
                if (typeof (item as any).line === 'number') {
                    addRange((item as any).line);
                } else if (typeof (item as any).start === 'number' && typeof (item as any).end === 'number') {
                    addRange((item as any).start, (item as any).end);
                } else if ((item as any).startLine !== undefined && (item as any).endLine !== undefined) {
                    addRange(Number((item as any).startLine), Number((item as any).endLine));
                }
            }
        }
    }
    return lineSet;
};

// Expose global click handlers for the inline buttons rendered in outputAtom
if (typeof window !== 'undefined') {
    // Comment out redundant assertions
    (window as any).__commentRedundantAssertions = () => {
        try {
            const linesData = __redundantLinesToRemove;
            if (!linesData) return;

            const editorValue = (jotaiStore.get(editorValueAtom) as string) || '';
            const lines = editorValue.split(/\r?\n/);
            const max = lines.length;

            const toComment = parseLinesToSet(linesData, max);

            // Comment out lines; no need for descending order since we don't change indices
            const sorted = Array.from(toComment).sort((a, b) => a - b);
            for (const ln of sorted) {
                const idx = ln - 1; // convert 1-based to 0-based
                if (idx >= 0 && idx < lines.length) {
                    const original = lines[idx];
                    // Skip if already commented
                    if (/^\s*;/.test(original)) continue;
                    // Preserve leading indentation when inserting '; '
                    const m = original.match(/^(\s*)(.*)$/);
                    const indent = m ? m[1] : '';
                    const rest = m ? m[2] : original;
                    lines[idx] = `${indent}; ${rest}`;
                }
            }

            const updated = lines.join('\n');
            jotaiStore.set(editorValueAtom, updated);
            jotaiStore.set(lineToHighlightAtom, []);
            jotaiStore.set(outputAtom, '; Commented out redundant assertions');

            // Log the action
            const permalink = jotaiStore.get(permalinkAtom);
            logToDb(permalink.permalink || '', {
                action: 'comment-redundant-assertions',
                checkOption: __currentCheckOption,
                linesCount: sorted.length,
            });
        } catch (err) {
            jotaiStore.set(outputAtom, '; Failed to comment out lines');
            const permalink = jotaiStore.get(permalinkAtom);
            logToDb(permalink.permalink || '', {
                action: 'comment-redundant-assertions-failed',
                checkOption: __currentCheckOption,
            });
        }
    };

    // Remove redundant assertions
    (window as any).__removeRedundantAssertions = () => {
        try {
            const linesData = __redundantLinesToRemove;
            if (!linesData) return;

            const editorValue = (jotaiStore.get(editorValueAtom) as string) || '';
            const lines = editorValue.split(/\r?\n/);
            const max = lines.length;

            const toRemove = parseLinesToSet(linesData, max);

            // Remove lines in descending order to avoid index shifting
            const sorted = Array.from(toRemove).sort((a, b) => b - a);
            for (const ln of sorted) {
                const idx = ln - 1; // convert 1-based to 0-based
                if (idx >= 0 && idx < lines.length) {
                    lines.splice(idx, 1);
                }
            }

            const updated = lines.join('\n');
            jotaiStore.set(editorValueAtom, updated);
            jotaiStore.set(lineToHighlightAtom, []);
            jotaiStore.set(outputAtom, '; Removed redundant assertions');

            // Log the action
            const permalink = jotaiStore.get(permalinkAtom);
            logToDb(permalink.permalink || '', {
                action: 'remove-redundant-assertions',
                checkOption: __currentCheckOption,
                linesCount: sorted.length,
            });
        } catch (err) {
            jotaiStore.set(outputAtom, '; Failed to remove lines');
            const permalink = jotaiStore.get(permalinkAtom);
            logToDb(permalink.permalink || '', {
                action: 'remove-redundant-assertions-failed',
                checkOption: __currentCheckOption,
            });
        }
    };
}

async function fetchZ3Result(permalink: Permalink) {
    let url = `/smt/smt/run/?check=${permalink.check}&p=${permalink.permalink}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        throw error;
    }
}

// Fetch generated assignment (extract assertions and code without assertions)
async function fetchGenerateAssignment(permalink: Permalink) {
    let url = `/smt/smt/generate-assignment/?check=${permalink.check}&p=${permalink.permalink}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        throw error;
    }
}

/**
 * Execute Z3 on the server.
 * Handles redundant assertions if returned by the server.
 */
export const executeZ3WithOptionOnServer = async () => {
    const smtCliOption = jotaiStore.get(smtCliOptionsAtom);

    // Clear the smtModelAtom when starting a new execution
    jotaiStore.set(smtModelAtom, null);

    // Determine which function to execute based on the selected option
    if (smtCliOption?.value === 'explain-redundancy') {
        await executeExplainRedundancy();
    } else if (smtCliOption?.value === 'check-redundancy') {
        await executeCheckRedundancy();
    } else if (smtCliOption?.value === 'iterate-models') {
        await executeIterateModels();
    } else if (smtCliOption?.value === 'assess-assignment') {
        await executeAssessAssignment();
    } else if (smtCliOption?.value === 'generate-assignment') {
        executeGenerateAssignment();
    } else if (smtCliOption?.value === 'execute-z3') {
        await executeZ3();
    }
};

// Execute Z3 to explain redundancy at the current cursor line.
async function executeExplainRedundancy() {
    const editorValue = jotaiStore.get(editorValueAtom);
    const language = jotaiStore.get(languageAtom);
    const permalink = jotaiStore.get(permalinkAtom);
    const enableLsp = jotaiStore.get(enableLspAtom);
    const cursorLine = jotaiStore.get(cursorLineAtom);
    const cursorColumn = jotaiStore.get(cursorColumnAtom);
    const selectedText = jotaiStore.get(selectedTextAtom);
    const selectionRange = jotaiStore.get(selectionRangeAtom);
    const smtCmdOption = jotaiStore.get(smtCliOptionsAtom);

    // Set current check option for logging
    __currentCheckOption = smtCmdOption.value || 'explain-redundancy';

    let response: any = null;
    const metadata = { ls: enableLsp, command: smtCmdOption.value };

    try {
        response = await saveCodeAndRefreshHistory(editorValue, language.short, permalink.permalink || null, metadata);
        if (response) {
            jotaiStore.set(permalinkAtom, response.data);
        }
    } catch (error: any) {
        jotaiStore.set(
            outputAtom,
            `Something went wrong. If the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
        jotaiStore.set(isExecutingAtom, false);
        return;
    }

    try {
        let result;
        let assertionText: string | null = null;

        // Try to extract the assertion from the editor
        // This handles both partial selection and multiple assertions on same line
        if (selectedText && selectedText.trim().length > 0) {
            // User has selected some text - extract the full assertion containing the selection
            assertionText = extractAssertion(
                editorValue,
                cursorLine,
                cursorColumn,
                selectionRange?.startLine,
                selectionRange?.startColumn,
                selectionRange?.endLine,
                selectionRange?.endColumn
            );
        } else {
            // No selection - extract assertion at cursor position
            assertionText = extractAssertion(editorValue, cursorLine, cursorColumn);
        }

        // If we found an assertion, validate and use it
        if (assertionText && assertionText.trim().length > 0) {
            // Validate the extracted assertion
            const validation = validateAssertion(assertionText);

            if (!validation.isValid) {
                // Show error message if validation fails
                jotaiStore.set(outputAtom, `; Error: ${validation.error}`);
                jotaiStore.set(greenHighlightAtom, []);
                jotaiStore.set(lineToHighlightAtom, []);
                jotaiStore.set(isExecutingAtom, false);
                return;
            }

            // Use the validated assertion text
            result = await explainRedundancy(
                response?.data.check,
                response?.data.permalink,
                undefined,
                validation.normalizedText
            );
        } else {
            // Fall back to using cursor line if no assertion found at cursor
            result = await explainRedundancy(response?.data.check, response?.data.permalink, cursorLine);
        }

        // Parse line ranges and set range-based highlighting
        const minimalRanges = parseRangesToMonaco(result.lineRanges);
        const targetRange = result.targetAssertionRange ? parseRangesToMonaco([result.targetAssertionRange])[0] : null;

        // Set the range atoms for precise highlighting
        jotaiStore.set(minimalSetRangesAtom, minimalRanges);
        jotaiStore.set(targetAssertionRangeAtom, targetRange);

        // Keep the old atoms for backward compatibility (can be removed later)
        const linesToHighlight = parseLineRanges(result.lineRanges);
        jotaiStore.set(greenHighlightAtom, linesToHighlight);
        jotaiStore.set(lineToHighlightAtom, [cursorLine]);

        // Format output message based on whether redundant assertions were found
        let outputMsg: string;
        if (result.lineRanges.length === 0) {
            outputMsg = `; No redundant assertion found.\n; Perhaps you selected a wrong or stronger assertion.`;
        } else {
            outputMsg =
                `; The green highlighted assertions make the yellow highlighted assertion redundant.` +
                `\n<button onclick="__commentRedundantAssertions()">Comment out</button> ` +
                `<button onclick="__removeRedundantAssertions()">Remove</button>`;
        }

        jotaiStore.set(outputAtom, outputMsg);
    } catch (error: any) {
        jotaiStore.set(
            outputAtom,
            `; ${error.message}\n; If the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
        jotaiStore.set(greenHighlightAtom, []);
        jotaiStore.set(lineToHighlightAtom, []);
        jotaiStore.set(minimalSetRangesAtom, []);
        jotaiStore.set(targetAssertionRangeAtom, null);
    }

    jotaiStore.set(isExecutingAtom, false);
}

//Execute Z3 to check for redundancy
async function executeCheckRedundancy() {
    const editorValue = jotaiStore.get(editorValueAtom);
    const language = jotaiStore.get(languageAtom);
    const permalink = jotaiStore.get(permalinkAtom);
    const enableLsp = jotaiStore.get(enableLspAtom);
    const smtCmdOption = jotaiStore.get(smtCliOptionsAtom);

    // Set current check option for logging
    __currentCheckOption = smtCmdOption.value || 'check-redundancy';

    let response: any = null;
    const metadata = { ls: enableLsp, command: smtCmdOption.value };
    try {
        response = await saveCodeAndRefreshHistory(editorValue, language.short, permalink.permalink || null, metadata);
        if (response) {
            jotaiStore.set(permalinkAtom, response.data);
        }
    } catch (error: any) {
        jotaiStore.set(
            outputAtom,
            `Something went wrong. If the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
        jotaiStore.set(isExecutingAtom, false);
        return;
    }

    try {
        const result = await checkRedundancy(response?.data.check, response?.data.permalink);

        // Check for errors in the output
        if (result.output.includes('(error')) {
            jotaiStore.set(outputAtom, result.output);
            jotaiStore.set(lineToHighlightAtom, getLineToHighlight(result.output, language.id) || []);
            jotaiStore.set(greenHighlightAtom, []);
            jotaiStore.set(isExecutingAtom, false);
            return;
        }

        // Check if redundant lines were found
        if (result.redundantLines && result.redundantLines.length > 0) {
            __redundantLinesToRemove = result.redundantLines;
            jotaiStore.set(lineToHighlightAtom, result.redundantLines);
            jotaiStore.set(greenHighlightAtom, []);

            const msg =
                result.output +
                `; Redundant assertions are highlighted in the editor).\n; Do you want to remove them?` +
                `\n<button onclick="__commentRedundantAssertions()">Comment out</button> ` +
                `<button onclick="__removeRedundantAssertions()">Remove</button>`;
            jotaiStore.set(outputAtom, msg);
            jotaiStore.set(isExecutingAtom, false);
            return;
        }

        // No redundant lines found
        const outputMsg = result.output + '; No redundant assertions found.';
        jotaiStore.set(outputAtom, outputMsg);
        jotaiStore.set(greenHighlightAtom, []);
        jotaiStore.set(lineToHighlightAtom, []);
    } catch (error: any) {
        jotaiStore.set(
            outputAtom,
            `; Error: ${error.message}\nIf the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
        jotaiStore.set(greenHighlightAtom, []);
        jotaiStore.set(isExecutingAtom, false);
        return;
    }
    jotaiStore.set(isExecutingAtom, false);
}

//Execute Z3 normally
async function executeZ3() {
    const editorValue = jotaiStore.get(editorValueAtom);
    const language = jotaiStore.get(languageAtom);
    const permalink = jotaiStore.get(permalinkAtom);
    const enableLsp = jotaiStore.get(enableLspAtom);
    const smtCmdOption = jotaiStore.get(smtCliOptionsAtom);

    // Set current check option for logging
    __currentCheckOption = smtCmdOption.value || 'execute-z3';

    let response: any = null;
    const metadata = { ls: enableLsp, command: smtCmdOption.value };
    try {
        response = await saveCodeAndRefreshHistory(editorValue, language.short, permalink.permalink || null, metadata);
        if (response) {
            jotaiStore.set(permalinkAtom, response.data);
        }
    } catch (error: any) {
        jotaiStore.set(
            outputAtom,
            `Something went wrong. If the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
    }

    try {
        const res = await fetchZ3Result(response?.data);

        // Handle new response format from backend
        // Backend returns: { result: string, redundant_lines: array }
        // Use nullish coalescing and provide safe defaults so empty strings/arrays are preserved
        const result: string = res.result ?? res[0] ?? '';
        const redundantLines: any[] = res.redundant_lines ?? res[1] ?? [];

        if (result.includes('(error')) {
            jotaiStore.set(outputAtom, result);
            jotaiStore.set(smtModelAtom, { result: result, error: true });
            jotaiStore.set(lineToHighlightAtom, getLineToHighlight(result, language.id) || []);
            jotaiStore.set(isExecutingAtom, false);
            return;
        }
        if (redundantLines && redundantLines.length > 0) {
            __redundantLinesToRemove = redundantLines;
            jotaiStore.set(lineToHighlightAtom, redundantLines);

            const msg =
                result +
                `; --------------------------------\n; Your script contains redundant assertions (see highlighted lines).\n; Do you want to remove them?` +
                `\n<button onclick="__commentRedundantAssertions()">Comment out</button> ` +
                `<button onclick="__removeRedundantAssertions()">Remove</button>`;
            jotaiStore.set(outputAtom, msg);
            jotaiStore.set(smtModelAtom, { result: msg });
            jotaiStore.set(isExecutingAtom, false);
            return;
        }

        jotaiStore.set(outputAtom, result);
        jotaiStore.set(smtModelAtom, { result: result });
    } catch (error) {
        jotaiStore.set(
            outputAtom,
            (error as any).message +
                `\nIf the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
        jotaiStore.set(smtModelAtom, { error: (error as any).message });
        jotaiStore.set(isExecutingAtom, false);
        return;
    }
    jotaiStore.set(isExecutingAtom, false);
}

// Iterate through SMT models
async function executeIterateModels() {
    const editorValue = jotaiStore.get(editorValueAtom);
    const language = jotaiStore.get(languageAtom);
    const permalink = jotaiStore.get(permalinkAtom);
    const enableLsp = jotaiStore.get(enableLspAtom);
    const smtCmdOption = jotaiStore.get(smtCliOptionsAtom);

    // Set current check option for logging
    __currentCheckOption = smtCmdOption.value || 'iterate-models';

    let response: any = null;
    const metadata = { ls: enableLsp, command: smtCmdOption.value };
    try {
        response = await saveCodeAndRefreshHistory(editorValue, language.short, permalink.permalink || null, metadata);
        if (response) {
            jotaiStore.set(permalinkAtom, response.data);
        }
    } catch (error: any) {
        jotaiStore.set(
            outputAtom,
            `Something went wrong. If the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
        jotaiStore.set(isExecutingAtom, false);
        return;
    }

    try {
        // Use the initiateModelIteration function from smtIterateModels.ts
        const modelData = await initiateModelIteration(response?.data.check, response?.data.permalink);

        // Set the model with specId for next/previous navigation
        jotaiStore.set(smtModelAtom, {
            specId: modelData.specId,
            result: modelData.result,
            next_model: modelData.result,
        });
        jotaiStore.set(outputAtom, modelData.result);

        // Log the initial model iteration
        logToDb(response?.data.permalink || '', {
            analysis: 'SMT-ModelIteration-Init',
            specId: modelData.specId,
        });
    } catch (error: any) {
        jotaiStore.set(
            outputAtom,
            `; Error: ${error.message}\nIf the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
        jotaiStore.set(smtModelAtom, { error: error.message });
        jotaiStore.set(isExecutingAtom, false);
        return;
    }
    jotaiStore.set(isExecutingAtom, false);
}

async function executeAssessAssignment() {
    const hiddenFieldValue = jotaiStore.get(hiddenFieldValueAtom);
    const language = jotaiStore.get(languageAtom);
    let permalink = jotaiStore.get(permalinkAtom);
    const enableLsp = jotaiStore.get(enableLspAtom);
    const smtCmdOption = jotaiStore.get(smtCliOptionsAtom);

    // Set current check option for logging
    __currentCheckOption = smtCmdOption.value || 'execute-z3';

    let response: any = null;
    const metadata = { ls: enableLsp, command: smtCmdOption.value };
    try {
        response = await saveCodeAndRefreshHistory(hiddenFieldValue, language.short, permalink.permalink || null, metadata);
        if (response) {
            jotaiStore.set(permalinkAtom, response.data);
        }
    } catch (error: any) {
        jotaiStore.set(
            outputAtom,
            `Something went wrong. If the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
    }

    try {
        const res = await fetchZ3Result(response?.data);

        // Handle new response format from backend
        // Backend returns: { result: string, redundant_lines: array }
        // Use nullish coalescing and provide safe defaults so empty strings/arrays are preserved
        const result: string = res.result ?? res[0] ?? '';
        const redundantLines: any[] = res.redundant_lines ?? res[1] ?? [];
        console.log(result)

        if (result.includes('(error')) {
            jotaiStore.set(outputAtom, result);
            jotaiStore.set(smtModelAtom, { result: result, error: true });
            jotaiStore.set(lineToHighlightAtom, getLineToHighlight(result, language.id) || []);
            jotaiStore.set(isExecutingAtom, false);
            return;
        }
        if (redundantLines && redundantLines.length > 0) {
            __redundantLinesToRemove = redundantLines;
            jotaiStore.set(lineToHighlightAtom, redundantLines);

            const msg =
                result +
                `; --------------------------------\n; Your script contains redundant assertions (see highlighted lines).\n; Do you want to remove them?` +
                `\n<button onclick="__commentRedundantAssertions()">Comment out</button> ` +
                `<button onclick="__removeRedundantAssertions()">Remove</button>`;
            jotaiStore.set(outputAtom, msg);
            jotaiStore.set(smtModelAtom, { result: msg });
            jotaiStore.set(isExecutingAtom, false);
            return;
        }

        jotaiStore.set(outputAtom, result);
        jotaiStore.set(smtModelAtom, { result: result });
    } catch (error) {
        jotaiStore.set(
            outputAtom,
            (error as any).message +
                `\nIf the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
        jotaiStore.set(smtModelAtom, { error: (error as any).message });
        jotaiStore.set(isExecutingAtom, false);
        return;
    }
    jotaiStore.set(isExecutingAtom, false);
    return;
}

async function executeGenerateAssignment() {
    const referenceSpec = jotaiStore.get(assignmentAssessmentReferenceSpecAtom);
    const language = jotaiStore.get(languageAtom);
    let permalink = jotaiStore.get(permalinkAtom);
    const enableLsp = jotaiStore.get(enableLspAtom);
    const smtCmdOption = jotaiStore.get(smtCliOptionsAtom);

    // Set current check option for logging
    __currentCheckOption = smtCmdOption.value || 'execute-z3';

    let response: any = null;
    const metadata = { ls: enableLsp, command: smtCmdOption.value };
    try {
        response = await saveCodeAndRefreshHistory(referenceSpec, language.short, permalink.permalink || null, metadata);
        if (response) {
            jotaiStore.set(permalinkAtom, response.data);
        }
    } catch (error: any) {
        jotaiStore.set(
            outputAtom,
            `Something went wrong. If the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
    }

    try {
        // Call the generate-assignment endpoint which returns assertions + code without assertions
        const res = await fetchGenerateAssignment(response?.data);

        const assertions: string[] = res.assertions ?? [];
        const codeWithoutAssertions: string = res.code_without_assertions ?? '';

        let outMsg = '';
        if (assertions.length > 0) {
            outMsg += '; Extracted Assertions:\n';
            assertions.forEach((a, idx) => {
                outMsg += `; [${idx + 1}] ${a}\n`;
            });
            outMsg += '\n';
        }
        outMsg += '; Code without assertions:\n' + codeWithoutAssertions;

        jotaiStore.set(outputAtom, outMsg);
        jotaiStore.set(smtModelAtom, { result: outMsg });
    } catch (error) {
        jotaiStore.set(
            outputAtom,
            (error as any).message +
                `\nIf the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
        jotaiStore.set(smtModelAtom, { error: (error as any).message });
        jotaiStore.set(isExecutingAtom, false);
        return;
    }
    jotaiStore.set(isExecutingAtom, false);
    console.log(jotaiStore.get(assignmentAssessmentReferenceSpecAtom));
    permalink = jotaiStore.get(permalinkAtom)
    const link = `http://localhost:5173/?check=${permalink.check}&p=${permalink.permalink}`;
    window.open(link, "_blank");
    return;
}