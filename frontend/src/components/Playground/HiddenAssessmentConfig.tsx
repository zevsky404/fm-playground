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

    const [stringsToCompare,] = useState<string[]>([';', 'declare', 'check-sat', 'get-model']);

    // Update teacher reference when it changes?
    useEffect(() => {
        jotaiStore.set(assignmentAssessmentStudentSpecAtom, currentEditorValue)
    }, [currentEditorValue]);

    useEffect(() => {
        jotaiStore.set(assignmentAssessmentReferenceSpecAtom, referenceFormulas)
    }, [referenceFormulas]);

    const formattedReferenceFormulas = referenceFormulas
        .split('\n')
        .filter(line => !stringsToCompare.some(str => line.includes(str)))
        .map((line) => { return line.replace('(assert', '').trim(); });

    const formattedStudentSolution = currentEditorValue
        .split('\n')
        .filter(line => !stringsToCompare.some(str => line.includes(str)))
        .map((line) => { return line.replace('(assert', '').trim().slice(0, -1); });

    useEffect(() => {
        jotaiStore.set(
            hiddenFieldValueAtom,
            `(assert (=> ${formattedStudentSolution.length > 1 ? `(and ${formattedStudentSolution})` : formattedStudentSolution[0]} ({formattedReferenceFormulas})))`
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