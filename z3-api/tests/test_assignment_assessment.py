import json
import os
from z3 import SolverFor, Solver, And, Not, BoolVal
from utils.helper import get_logic_from_smt2
from main import remove_assertions_from_reference, check_completeness, check_soundness


def load_test_cases():
    path = os.path.join(os.path.dirname(__file__), "test-cases-assessment.json")
    with open(path) as f:
        return json.loads(f.read())['test-cases']


def test_functionalities():
    tests = load_test_cases()

    for test in tests:
        test_id = test["test-id"]
        name = test["test-case-name"]
        teacher = test["teacher-reference"]
        student = test["student-solution"]
        expected_sound = test["sound"]
        expected_complete = test["complete"]
        error = test["error"]
        reference_no_assertions = test["reference-no-assertions"]

        try:
            f"Running Test {test_id}: {name}"
            # Determine logic from code to create solvers, which extract assertions from the code
            logic = get_logic_from_smt2(teacher)
            solver_teacher = SolverFor(logic) if logic else Solver()
            solver_teacher.from_string(teacher)
            assertions_teacher = solver_teacher.assertions()

            logic = get_logic_from_smt2(student)
            solver_student = SolverFor(logic) if logic else Solver()
            solver_student.from_string(student)
            assertions_student = solver_student.assertions()

            if test["error"]:
                f"✘ Test {test_id} failed: Expected a syntax/logic error but none occurred."
                continue

            sound = check_soundness(student, assertions_student, assertions_teacher)["result"]  == "unsat"
            assert sound == expected_sound, \
                f"Soundness missmatch in test {test_id}"

            complete = check_completeness(student, assertions_student, assertions_teacher)["result"] == "unsat"
            assert complete == expected_complete, \
                f"Soundness missmatch in test {test_id}"

            cleand_reference = remove_assertions_from_reference(teacher)

            assert cleand_reference == reference_no_assertions, \
                f"Assertion removal failed in test {test_id}"

            f"✓ Test {test_id} passed"

        except Exception as e:
            if error:
                f"✓ Test {test_id} caught expected error: {str(e)}"
            else:
                f"✘ Test {test_id} crashed unexpectedly: {e}"



if __name__ == '__main__':
    test_functionalities()