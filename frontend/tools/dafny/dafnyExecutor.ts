import { saveCodeAndRefreshHistory } from '@/utils/codeExecutionUtils';
import { fmpConfig } from '@/ToolMaps';
import { getLineToHighlight } from '@/../tools/common/lineHighlightingUtil';
import {
    editorValueAtom,
    jotaiStore,
    languageAtom,
    lineToHighlightAtom,
    permalinkAtom,
    isExecutingAtom,
    outputAtom,
    dafnyCliOptionsAtom,
    enableLspAtom,
} from '@/atoms';
import { Permalink } from '@/types';
import axios from 'axios';

async function verifyDafny(permalink: Permalink) {
    let url = `/dafny/dfy/verify/?check=${permalink.check}&p=${permalink.permalink}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        throw error;
    }
}

async function runDafny(permalink: Permalink) {
    let url = `/dafny/dfy/run/?check=${permalink.check}&p=${permalink.permalink}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        throw error;
    }
}

async function translateDafny(permalink: Permalink, targetLanguage: string) {
    let url = `/dafny/dfy/translate/${targetLanguage}?check=${permalink.check}&p=${permalink.permalink}`;
    try {
        const response = await axios.get(url, {
            responseType: 'blob', // Important for downloading files
        });

        // Create a download link for the zip file
        const blob = new Blob([response.data], { type: 'application/zip' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${permalink.permalink}-${targetLanguage}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

        return `Translation to ${targetLanguage.toUpperCase()} completed successfully. Save the zip file or check your downloads folder for the zip file named ${permalink.permalink}-${targetLanguage}.zip`;
    } catch (error) {
        throw error;
    }
}

async function executeDafny(permalink: Permalink, cliOption: string) {
    // Parse the CLI option to determine the action
    if (cliOption === 'verify') {
        return await verifyDafny(permalink);
    } else if (cliOption === 'run') {
        return await runDafny(permalink);
    } else if (cliOption.startsWith('translate-')) {
        // Extract target language from option (e.g., 'translate-py' -> 'py')
        const targetLanguage = cliOption.replace('translate-', '');
        return await translateDafny(permalink, targetLanguage);
    } else {
        throw new Error(`Unknown Dafny CLI option: ${cliOption}`);
    }
}

export const executeDafnyTool = async () => {
    const editorValue = jotaiStore.get(editorValueAtom);
    const language = jotaiStore.get(languageAtom);
    const permalink = jotaiStore.get(permalinkAtom);
    const dafnyCliOption = jotaiStore.get(dafnyCliOptionsAtom);
    const enableLsp = jotaiStore.get(enableLspAtom);
    const metadata = { check: dafnyCliOption.value, ls: enableLsp };

    const response = await saveCodeAndRefreshHistory(
        editorValue,
        language.short,
        permalink.permalink || null,
        metadata
    );
    if (response) {
        jotaiStore.set(permalinkAtom, response.data);
    } else {
        jotaiStore.set(
            outputAtom,
            `Something went wrong. If the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
        jotaiStore.set(isExecutingAtom, false);
        return;
    }

    try {
        // Extract the value from the CLI option object
        const cliOptionValue = typeof dafnyCliOption === 'string' ? dafnyCliOption : dafnyCliOption.value;
        const res = await executeDafny(response?.data, cliOptionValue);
        jotaiStore.set(lineToHighlightAtom, getLineToHighlight(res, language.id) || []);
        jotaiStore.set(outputAtom, res);
    } catch (err: any) {
        // Extract error detail from server response
        let serverDetailRaw = err?.response?.data ?? err?.message ?? String(err);
        let serverDetail: string;

        try {
            if (serverDetailRaw instanceof Blob) {
                // Blob response (e.g., from translate endpoint with responseType: 'blob')
                serverDetail = await serverDetailRaw.text();
                // Parse JSON if the blob contains JSON
                try {
                    const parsed = JSON.parse(serverDetail);
                    serverDetail = parsed?.detail ?? serverDetail;
                } catch {
                    // Not JSON, use as-is
                }
            } else if (typeof serverDetailRaw === 'object') {
                // Object response like { detail: '...' }
                serverDetail = serverDetailRaw?.detail ?? JSON.stringify(serverDetailRaw, null, 2);
            } else {
                serverDetail = String(serverDetailRaw);
            }
        } catch {
            serverDetail = String(serverDetailRaw);
        }

        jotaiStore.set(lineToHighlightAtom, getLineToHighlight(serverDetail, language.id) || []);
        jotaiStore.set(
            outputAtom,
            `${serverDetail}. If the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
        );
    }
    jotaiStore.set(isExecutingAtom, false);
};
