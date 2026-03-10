import React, { useState} from 'react';

interface ConfigProps {
    referenceFormulas : string[],
    studentFormulas : string[]
}

const HiddenAssessmentConfig : React.FC<ConfigProps> = ({ referenceFormulas, studentFormulas }) => {
    const [isHidden] = useState(false);

    const formattedReferenceFormulas = referenceFormulas.map((item, index) =>  (
        <span key={index}>{item}</span>
    ));

    const formattedStudentFormulas = studentFormulas.map((item, index) =>  (
        <span key={index}>{item}</span>
    ));

    return (
        <div className='hidden-assessment-config' hidden={isHidden}>
            <div>
                (assert
                    (={'>'}
                        ({formattedStudentFormulas})
                        ({formattedReferenceFormulas})
                    )
                )
            </div>
        </div>
    );
}

export default HiddenAssessmentConfig;