import React, { useEffect, useState } from 'react';
//import {useAtom} from 'jotai';
import {
    assignmentAssessmentReferenceSpecAtom,
    assignmentAssessmentStudentSpecAtom,
    hiddenFieldValueAtom,
    jotaiStore,
} from '@/atoms';

interface ConfigProps {
    referenceFormulas : string,
    currentEditorValue : string
}

const HiddenAssessmentConfig : React.FC<ConfigProps> = ({ referenceFormulas, currentEditorValue }) => {
    const [isHidden] = useState(false);
    //const [studentSpec, setStudentSpec] = useAtom(assignmentAssessmentStudentSpecAtom);
    //const [refSpec, setRefSpec] = useAtom(assignmentAssessmentReferenceSpecAtom);

    const extractAssertions = (content: string): string[] => {
        const results: string[] = [];
        let index = 0;

        while (index < content.length) {
            const start = content.indexOf("(assert", index);
            if (start === -1) break;

            let parenCount = 0;
            let end = start;

            for (; end < content.length; end++) {

                if (content[end] === "(") parenCount++;
                if (content[end] === ")") parenCount--;

                if (parenCount === 0) {
                    end++;
                    break;
                }
            }

            const assertion = content.slice(start, end).trim();

            if (assertion) {
                results.push(assertion);
            }

            index = end;
        }
        return results
    }

    // Update teacher reference when it changes?
    useEffect(() => {
        jotaiStore.set(assignmentAssessmentStudentSpecAtom, currentEditorValue)
    }, [currentEditorValue]);

    useEffect(() => {
        jotaiStore.set(assignmentAssessmentReferenceSpecAtom, referenceFormulas)
    }, [referenceFormulas]);

    const formattedReferenceFormulas = extractAssertions(referenceFormulas)
        .map((line) => { return line.replace('(assert', '').trim().slice(0, -1); })
        .join(' ');

    const formattedStudentSolution = extractAssertions(currentEditorValue)
        .map((line) => { return line.replace('(assert', '').trim().slice(0, -1); })
        .join(' ');
    
    useEffect(() => {
        jotaiStore.set(
            hiddenFieldValueAtom,
            `(assert (=> ${formattedStudentSolution.length > 1 ? `(and ${formattedStudentSolution})` : formattedStudentSolution[0]} (${formattedReferenceFormulas})))`
        );
    }, [formattedStudentSolution]);

    return (
        <div className='hidden-assessment-config' hidden={isHidden}>
            <div>
                (assert
                    (={'>'}
                        {formattedStudentSolution.length > 1 ? `(and${formattedStudentSolution})` : formattedStudentSolution[0]}
                        ({formattedReferenceFormulas})
                    )
                )
            </div>
            <span>{jotaiStore.get(hiddenFieldValueAtom)}</span>
        </div>
    );
}

export default HiddenAssessmentConfig;