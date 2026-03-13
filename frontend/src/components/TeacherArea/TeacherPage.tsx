import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAtom } from 'jotai';
import { Tooltip } from 'react-tooltip';
import MessageModal from '@/components/Utils/Modals/MessageModal';
import { getCodeByParmalink, getMetadataByPermalink, getCodeById } from '@/api/playgroundApi';
import { fmpConfig, toolExecutionMap } from '@/ToolMaps';
import {
    editorValueAtom,
    languageAtom,
    permalinkAtom,
    isExecutingAtom,
    outputAtom,
    isFullScreenAtom,
    isLoadingPermalinkAtom,
    isDiffViewModeAtom,
    originalCodeAtom,
    diffComparisonCodeAtom,
    diffComparisonHistoryIdAtom,
    assignmentAssessmentReferenceSpecAtom,
    smtCliOptionsAtom
} from '@/atoms';

import OutputArea from '@/components/Playground//OutputArea';
import DiffViewArea from '@/components/Playground/DiffViewArea';
import ResizableSplitter from '@/components/Utils/ResizableSplitter';
import TeacherEditor from "@/components/TeacherArea/TeacherEditor.tsx";

import '@/assets/style/Playground.css';
import smtCheckOptions from "../../../tools/smt/components/smtCheckOptions.tsx";


interface PlaygroundProps {
    editorTheme: string;
}

const Playground: React.FC<PlaygroundProps> = ({ editorTheme }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const inputDivRef = useRef<HTMLDivElement>(null); // contains the reference to the editor area
    const outputDivRef = useRef<HTMLDivElement>(null); // contains the reference to the output area
    const [, setEditorValue] = useAtom(editorValueAtom);
    const [language, setLanguage] = useAtom(languageAtom);
    const [permalink, setPermalink] = useAtom(permalinkAtom);
    const [, setOutput] = useAtom(outputAtom); // contains the output from the tool execution.
    const [, setIsExecuting] = useAtom(isExecutingAtom); // contains the state of the tool execution.
    const [, setIsFullScreen] = useAtom(isFullScreenAtom); // contains the state of the full screen mode.
    const [, setIsLoadingPermalink] = useAtom(isLoadingPermalinkAtom); // contains the state of loading permalink.
    const [isDiffViewMode, setIsDiffViewMode] = useAtom(isDiffViewModeAtom); // contains the state of diff view mode.
    const [originalCode] = useAtom(originalCodeAtom); // contains the original code for diff view.
    const [, setDiffComparisonCode] = useAtom(diffComparisonCodeAtom); // contains the comparison code for diff view.
    const [, setDiffComparisonHistoryId] = useAtom(diffComparisonHistoryIdAtom); // contains the history ID of the comparison code.
    const [errorMessage, setErrorMessage] = useState<string | null>(null); // contains the error messages from the API.
    const [isErrorMessageModalOpen, setIsErrorMessageModalOpen] = useState(false); // contains the state of the message modal.
    const [referenceSpec,setReferenceSpec] = useAtom(assignmentAssessmentReferenceSpecAtom);
    const [smtCheckOption] = useAtom(smtCliOptionsAtom);

    /**
     * Load the code and language from the URL.
     */
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const refParam = urlParams.get('ref');
        if (refParam){
            try {
                const decoded = JSON.parse(decodeURIComponent(refParam));
                setReferenceSpec(decoded);
                console.log(decoded);
            } catch (err){
                console.error("Failed to parse reference spec:", err);
            }
        }
        let checkParam = urlParams.get('check');
        if (checkParam === 'VAL' || checkParam === 'QBF') {
            checkParam = 'SAT';
        } // v2.0.0: VAL and QBF are merged into SAT

        const permalinkParam = urlParams.get('p');

        const options = Object.entries(fmpConfig.tools).map(([key, tool]) => ({
            id: key,
            value: tool.extension,
            label: tool.name,
            short: tool.shortName,
        }));

        const isDiffMode = checkParam?.endsWith('Diff');
        let baseCheckParam = checkParam;

        if (isDiffMode && checkParam) {
            baseCheckParam = checkParam
                .replace(/SynDiff$/, '')
                .replace(/SemDiff$/, '')
                .replace(/Diff$/, '');

            setIsDiffViewMode(true);
        }

        const selectedOption = options.find((option) => option.short === "SMT");

        // Update the selected language if 'check' parameter is present firstAdd commentMore actions
        if (selectedOption) {
            setLanguage(selectedOption);
        }
        // Load the code if 'check' parameter is present
        if (permalinkParam) {
            if (checkParam && permalinkParam) {
                setIsLoadingPermalink(true);
                loadCode(checkParam, permalinkParam);
            }
            setPermalink({ check: checkParam, permalink: permalinkParam });
        }
    }, []);

    /**
     * Update the URL when permalink changes.
     */
    useEffect(() => {

        // Do not modify URL when inside teacher mode
        if (location.pathname === "/teacher") return;

        const urlParams = new URLSearchParams(window.location.search);
        const checkParam = "SMT";

        navigate(
            permalink.permalink
                ? `/?check=${permalink.check}&p=${permalink.permalink}`
                : `/?check=${checkParam}`
        );

    }, [permalink, navigate, location.pathname]);

    const loadCode = async (check: string, permalink: string) => {
        try {
            const res = await getCodeByParmalink(check, permalink);
            setEditorValue(res.code);

            // If this is a diff mode URL, also load the comparison code
            if (check.endsWith('Diff')) {
                try {
                    const metadataResponse = await getMetadataByPermalink(check, permalink);
                    const parsed =
                        typeof metadataResponse === 'string' ? JSON.parse(metadataResponse) : metadataResponse;

                    const leftSideCodeId = parsed.meta.leftSideCodeId;
                    const originalRes = await getCodeById(leftSideCodeId);
                    if (originalRes?.code) {
                        setDiffComparisonCode(originalRes.code);
                        setDiffComparisonHistoryId(leftSideCodeId); // Set the history ID for the comparison code
                    } else {
                        console.warn('Could not load left side code by code_id.');
                    }
                } catch (err) {
                    console.error('Failed to load comparison code:', err);
                    showErrorModal('Failed to load the original specification for comparison.');
                }
            }

            setIsLoadingPermalink(false);
        } catch (_err) {
            alert('Permalink not found. Redirecting...');
            window.open(`/?check=SAT`, '_self');
            setIsLoadingPermalink(false);
        }
    };

    const generateAssignment = () => {

        if (!referenceSpec || referenceSpec.length === 0) {
            alert("No reference found.");
            return;
        }

        const encoded = encodeURIComponent(JSON.stringify(referenceSpec));

        const link = `http://localhost:5173/?ref=${encoded}`;

        window.open(link, "_blank");
    };

    const handleToolExecution = async () => {
        if (smtCheckOption?.value === "generate-assignment" ) {
            generateAssignment();
            return;

        }

        setOutput('');

        try {
            setIsExecuting(true);
            const currentTool = toolExecutionMap[language.short];
            if (currentTool) {
                currentTool();
            } else {
                setIsExecuting(false);
            }
        } catch (err: any) {
            if (err.code === 'ERR_NETWORK') {
                showErrorModal('Network Error. Please check your internet connection.');
            } else if (err.response.status === 413) {
                showErrorModal('Code too long. Please reduce the size of the code.');
            } else {
                showErrorModal(
                    `Something went wrong. If the problem persists, open an <a href="${fmpConfig.issues}" target="_blank">issue</a>`
                );
            }
        }
    };

    const toggleFullScreen = (div: 'input' | 'output') => {
        const element = { input: inputDivRef.current, output: outputDivRef.current }[div as 'input' | 'output'];
        const theme = localStorage.getItem('isDarkTheme') === 'true' ? 'dark' : 'light';
        if (!document.fullscreenElement) {
            // Enter fullscreen mode
            if (element?.requestFullscreen) {
                element.requestFullscreen();
            }
            document.documentElement.setAttribute('data-theme', theme);
            setIsFullScreen(true);
        } else {
            // Exit fullscreen mode
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
            document.documentElement.setAttribute('data-theme', theme);
            setIsFullScreen(false);
        }
    };

    /**
     * Add event listeners for full screen mode.
     * This is useful if the user presses the escape key to exit the full screen mode instead of clicking on the exit button.
     */
    useEffect(() => {
        const handleFullScreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullScreenChange);
        document.addEventListener('mozfullscreenchange', handleFullScreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
        document.addEventListener('msfullscreenchange', handleFullScreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullScreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullScreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
            document.removeEventListener('msfullscreenchange', handleFullScreenChange);
        };
    }, []);

    const showErrorModal = (message: string) => {
        setErrorMessage(message);
        setIsErrorMessageModalOpen(true);
    };

    const hideErrorModal = () => {
        setErrorMessage(null);
        setIsErrorMessageModalOpen(!isErrorMessageModalOpen);
    };

    const handleBackToEditing = () => {
        setIsDiffViewMode(false);
        // Clear comparison code when exiting diff mode
        setDiffComparisonCode('');
    };

    return (
        <div className='container-fluid Playground'>
            <h2>Assignment Creator</h2>
            <Tooltip id='playground-tooltip' />
            <div className='row Playground'>
                <div className='col-12'>
                    {isDiffViewMode ? (
                        <div ref={inputDivRef}>
                            <DiffViewArea
                                editorTheme={editorTheme}
                                onBackToEditingClick={handleBackToEditing}
                                onFullScreenButtonClick={() => toggleFullScreen('input')}
                                originalValue={originalCode}
                            />
                        </div>
                    ) : (
                        <ResizableSplitter
                            leftChild={
                                <div ref={inputDivRef}>
                                    <TeacherEditor
                                        editorTheme={editorTheme}
                                        onRunButtonClick={handleToolExecution}
                                        onFullScreenButtonClick={() => toggleFullScreen('input')}
                                    />
                                </div>
                            }
                            rightChild={
                                <div ref={outputDivRef}>
                                    <OutputArea onFullScreenButtonClick={() => toggleFullScreen('output')} />
                                </div>
                            }
                            initialLeftWidth={50}
                            minLeftWidth={25}
                            maxLeftWidth={75}
                            resizerWidth={12}
                            breakpoint={768}
                        />
                    )}
                </div>
            </div>
            {errorMessage && (
                <MessageModal
                    isErrorMessageModalOpen={isErrorMessageModalOpen}
                    setIsErrorMessageModalOpen={hideErrorModal}
                    toggleErrorMessageModal={hideErrorModal}
                    title='Error'
                    errorMessage={errorMessage}
                />
            )}
        </div>
    );
};

export default Playground;
