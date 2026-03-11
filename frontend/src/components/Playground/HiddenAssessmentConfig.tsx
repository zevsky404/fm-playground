import React, { useEffect, useState } from 'react';
import {useAtom} from 'jotai';
import {
    assignmentAssessmentReferenceSpecAtom,
    //assignmentAssessmentStudentSpecAtom,
} from '@/atoms';

interface ConfigProps {
    referenceFormulas : string[],
    currentEditorValue : string
}

const HiddenAssessmentConfig : React.FC<ConfigProps> = ({ referenceFormulas, currentEditorValue }) => {
    const [isHidden] = useState(false);
    //const [studentSpec, setStudentSpec] = useAtom(assignmentAssessmentStudentSpecAtom);
    const [refSpec, setRefSpec] = useAtom(assignmentAssessmentReferenceSpecAtom);

    const [stringsToCompare,] = useState<string[]>([';', 'declare', 'check-sat', 'get-model']);

    // Update teacher reference when it changes?
    useEffect(() => {
        setRefSpec(refSpec);
    }, [refSpec]);

    const formattedReferenceFormulas = referenceFormulas.map((item, index) =>  (
        <span key={index}>{item}</span>
    ));

    const formattedStudentSolution = currentEditorValue
        .split('\n')
        .filter(line => !stringsToCompare.some(str => line.includes(str)))
        .map((line) => { return line.replace('(assert', '').trim(); });

    return (
        <div className='hidden-assessment-config' hidden={isHidden}>
            <div>
                (assert
                    (={'>'}
                        ((and{formattedStudentSolution}))
                        ({formattedReferenceFormulas})
                    )
                )
            </div>
        </div>
    );
}

export default HiddenAssessmentConfig;