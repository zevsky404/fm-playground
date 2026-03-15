import { saveCode } from '@/api/playgroundApi';
import { jotaiStore, historyRefreshTriggerAtom } from '@/atoms';

/**
 * Wrapper around saveCode that also triggers a history refresh.
 * This ensures that when new code is saved, the history drawer automatically updates.
 *
 * @param editorValue - The code to save
 * @param language - The language/tool short name
 * @param permalink - The optional permalink
 * @param metadata - Optional metadata object
 * @param reference - Optional reference for assignment assessment
 * @returns Promise with the save response
 */
export const saveCodeAndRefreshHistory = async (
    editorValue: string,
    language: string,
    permalink: string | null,
    reference: string | null,
    metadata?: any,
) => {
    const response = await saveCode(editorValue, language, permalink, metadata, reference);

    // Trigger history refresh by incrementing the refresh trigger atom
    const currentValue = jotaiStore.get(historyRefreshTriggerAtom);
    jotaiStore.set(historyRefreshTriggerAtom, currentValue + 1);

    return response;
};


