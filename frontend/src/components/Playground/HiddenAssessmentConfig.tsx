import React, { useEffect, useState } from 'react';
//import {useAtom} from 'jotai';
import {
    assignmentAssessmentReferenceSpecAtom,
    assignmentAssessmentStudentSpecAtom,
    // hiddenFieldValueAtom,
    jotaiStore,
} from '@/atoms';

interface ConfigProps {
    teacherReference : string,
    studentSolution : string
}

const HiddenAssessmentConfig : React.FC<ConfigProps> = ({ teacherReference, studentSolution }) => {
    const [isHidden] = useState(false);
    //const [studentSpec, setStudentSpec] = useAtom(assignmentAssessmentStudentSpecAtom);
    //const [refSpec, setRefSpec] = useAtom(assignmentAssessmentReferenceSpecAtom);

    // Update teacher reference when it changes?
    useEffect(() => {
        jotaiStore.set(assignmentAssessmentStudentSpecAtom, studentSolution)
    }, [studentSolution]);

    useEffect(() => {
        jotaiStore.set(assignmentAssessmentReferenceSpecAtom, teacherReference)
    }, [teacherReference]);

    return (
        <div className='hidden-assessment-config' hidden={isHidden}>
            <div>
                <span>{studentSolution}</span>
                <span>{teacherReference}</span>
            </div>
        </div>
    );
}

export default HiddenAssessmentConfig;