import {useCallback, useState} from "react";
import Editor from "@monaco-editor/react";

interface Props {
    onChange: (assertions: string[]) => void;
}

const RefrenceInput: React.FC<Props> = ({ onChange }) => {
    const [editorValue, setEditorValue] = useState("");
    const [assertions, setAssertions] = useState<string[]>([]);

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

    const handleEditorChange = (value: string | undefined) => {
        const content = value || "";
        setEditorValue(content);

        const parsed = extractAssertions(content);

        setAssertions(parsed);
        onChange(parsed);
    };
    return (
        <div style={{ marginTop: "20px" }}>
            <Editor
                height = "400px"
                language = "smt-2"
                theme = "light"
                value={editorValue}
                onChange={handleEditorChange}
                options={{
                    minimap: {enabled: false},
                    fontSize: 14
                }}
            />

            <div style={{ marginTop: "10px" }}>
                <strong>Parsed Assertions:</strong>
                <ul>
                    {assertions.map((assertion, index) => (
                        <li key={index}>
                            <code>{assertion}</code>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default RefrenceInput;