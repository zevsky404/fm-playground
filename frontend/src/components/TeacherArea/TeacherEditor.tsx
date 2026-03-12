import { useState } from 'react';
import ReferenceInput from "@/components/TeacherArea/RefrenceInput"

const TeacherEditor = () => {
    const [referenceFormula, setReferenceFormula] = useState<string[]>([]);

    const generateAssignment = () => {

        if (referenceFormula.length === 0) {
            alert("No reference found.");
            return;
        }
        const encoded = encodeURIComponent(JSON.stringify(referenceFormula));

        const link = `http://localhost:5173/?check=SMT&ref=${encoded}`;

        window.open(link, "_blank");
    };

    return (
        <div>

            <ReferenceInput onChange={setReferenceFormula} />

            <button onClick={generateAssignment}>Generate Assignment</button>

        </div>
    );
};

export default TeacherEditor;