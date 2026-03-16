import json
import os
from typing import Optional, Union

import redis
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from markdown_it.rules_block import reference
from pydantic import BaseModel
from redis_cache import RedisCache
from z3 import SolverFor, Solver, And, Not, BoolVal
from utils.helper import get_logic_from_smt2

from smt_redundancy.explain_redundancy import (
    explain_redundancy_from_smtlib,
    explain_redundancy_from_smtlib_by_assertion,
)
from z3_exec.model_iteration import get_cache_info, get_next_model, iterate_models
from z3_exec.z3 import check_redundancy_only, execution_queue

load_dotenv()

API_URL = os.getenv("API_URL")
REDIS_URL = os.getenv("REDIS_URL")
client = redis.Redis.from_url(REDIS_URL)
cache = RedisCache(redis_client=client)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExplainRedundancyRequest(BaseModel):
    check: str
    p: str
    assertion_line: Optional[int] = None
    assertion_text: Optional[str] = None


def is_redis_available() -> bool:
    try:
        client.ping()
        return True
    except redis.ConnectionError:
        return False


def get_code_by_permalink(check: str, p: str) -> Union[str, None]:
    try:
        check = check.upper()
        if check == "SMT":
            url = f"{API_URL}api/permalink/?check={check}&p={p}"
            res = requests.get(url)
            code = res.json().get("code")
            return code
    except Exception:
        raise HTTPException(status_code=404, detail="Permalink not found")


def log_to_db(p: str, result: str):
    try:
        url = f"{API_URL}api/analysis/log"
        payload = {"permalink": p, "result": result}
        headers = {"Content-Type": "application/json"}
        requests.post(url, json=payload, headers=headers)
    except Exception:
        pass

def get_formula(assertions):
    if not assertions:
        return BoolVal(True)
    if len(assertions) == 1:
        return assertions[0]
    return And(*assertions)


def check_soundness(code, assertions_student, assertions_teacher):
    logic = get_logic_from_smt2(code)
    solver = SolverFor(logic) if logic else Solver()

    teacher_formula = get_formula(assertions_teacher)
    student_formula = get_formula(assertions_student)

    solver.add(student_formula, Not(teacher_formula))

    result = solver.check()

    if str(result) == 'sat':
        return {'result': str(result), 'model': str(solver.model())}
    else:
        return {'result': str(result), 'model': ''}



def check_completeness(code, assertions_student, assertions_teacher):
    logic = get_logic_from_smt2(code)
    solver = SolverFor(logic) if logic else Solver()

    teacher_formula = get_formula(assertions_teacher)
    student_formula = get_formula(assertions_student)

    solver.add(teacher_formula, Not(student_formula))

    result = solver.check()

    if str(result) == 'sat':
        return {'result': str(result), 'model': str(solver.model())}
    else:
        return {'result': str(result), 'model': ''}

def run_z3(code: str, check_redundancy: bool = False) -> str:
    if is_redis_available():

        @cache.cache()
        def cached_run_z3(code: str, check_redundancy: bool) -> str:
            return execution_queue(code, check_redundancy=check_redundancy)

        try:
            return cached_run_z3(code, check_redundancy=check_redundancy)
        except Exception as e:
            raise HTTPException(status_code=500, detail="Error running z3: " + str(e))
    else:
        try:
            return execution_queue(code, check_redundancy=check_redundancy)
        except Exception as e:
            raise HTTPException(status_code=500, detail="Error running z3: " + str(e))


## ------------------------- API Endpoints ------------------------- ##


@app.get("/health")
def health():
    return {"status": "UP"}


@app.get("/smt/run/", response_model=None)
def execute_z3(check: str, p: str):
    code = get_code_by_permalink(check, p)
    try:
        result, redundant_lines = execution_queue(code)
        log_to_db(
            p,
            json.dumps(
                {
                    "analysis": "run_z3",
                    "redundant_lines": list(redundant_lines),
                }
            ),
        )
        return {
            "result": result,
            "redundant_lines": list(redundant_lines),
        }
    except Exception as e:
        log_to_db(p, json.dumps({"analysis": "run_z3", "error": str(e)}))

        raise HTTPException(status_code=500, detail="Error running code: " + str(e))


@app.get("/smt/check-redundancy/", response_model=None)
def check_redundancy(check: str, p: str):
    code = get_code_by_permalink(check, p)
    try:
        result, redundant_lines = check_redundancy_only(code)
        log_to_db(
            p,
            json.dumps(
                {
                    "analysis": "check_redundancy",
                    "redundant_lines": list(redundant_lines),
                }
            ),
        )
        return {"result": result, "redundant_lines": redundant_lines}
    except Exception as e:
        log_to_db(p, json.dumps({"analysis": "check_redundancy", "error": str(e)}))
        raise HTTPException(status_code=500, detail="Error running code")


@app.post("/smt/explain-redundancy/", response_model=None)
def explain_redundancy(request: ExplainRedundancyRequest):
    code = get_code_by_permalink(request.check, request.p)
    try:
        # Validate that at least one parameter is provided
        if request.assertion_line is None and request.assertion_text is None:
            raise HTTPException(
                status_code=400,
                detail="Either assertion_line or assertion_text must be provided",
            )

        # If assertion_text is provided, use it; otherwise use assertion_line
        if request.assertion_text:
            (
                time_taken,
                minimal_set,
                given_assert,
                minimal_line_ranges,
                target_assertion_range,
            ) = explain_redundancy_from_smtlib_by_assertion(
                code, request.assertion_text, method="quick_explain"
            )
        else:
            (
                time_taken,
                minimal_set,
                given_assert,
                minimal_line_ranges,
                target_assertion_range,
            ) = explain_redundancy_from_smtlib(
                code, request.assertion_line, method="quick_explain"
            )
        log_to_db(
            request.p,
            json.dumps(
                {
                    "analysis": "explain_redundancy",
                    "time_taken": time_taken,
                    "minimal_set": [
                        str(expr) for expr in minimal_set
                    ],  # Convert Z3 expressions to strings
                    "given_assert": str(
                        given_assert
                    ),  # Convert Z3 expression to string
                    "minimal_line_ranges": minimal_line_ranges,
                    "target_assertion_range": target_assertion_range,
                }
            ),
        )
        return {
            "minimal_line_ranges": minimal_line_ranges,
            "target_assertion_range": target_assertion_range,
        }
    except ValueError as e:
        log_to_db(
            request.p,
            json.dumps({"analysis": "explain_redundancy", "error": str(e)}),
        )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_to_db(
            request.p,
            json.dumps({"analysis": "explain_redundancy", "error": str(e)}),
        )
        raise HTTPException(status_code=500, detail=f"Error running code: {str(e)}")


@app.get("/smt/model-iteration/", response_model=None)
def model_iteration(check: str, p: str):
    code = get_code_by_permalink(check, p)
    try:
        specId = iterate_models(code)
        if specId is None:
            raise HTTPException(status_code=500, detail="Error running code")
        result = get_next_model(specId)
        log_to_db(
            p,
            json.dumps(
                {
                    "specId": specId,
                    "analysis": "model_iteration",
                }
            ),
        )
        return {
            "specId": specId,
            "result": result,
        }
    except Exception as e:
        log_to_db(p, json.dumps({"analysis": "model_iteration", "error": str(e)}))
        raise HTTPException(status_code=500, detail="Error running code: " + str(e))

@app.get("/smt/next/", response_model=None)
def get_next_model_from_cache(specId: str, p: str):
    try:
        cache_info = get_cache_info(specId)
        if cache_info is None:
            raise HTTPException(
                status_code=404, detail=f"Cache not found or expired: {specId}"
            )
        next_model = get_next_model(specId)

        if next_model is None:
            raise HTTPException(
                status_code=404, detail="No more models or cache exhausted"
            )
        return {
            "specId": specId,
            "next_model": next_model,
        }
    except HTTPException:
        raise
    except Exception as e:
        log_to_db(p, json.dumps({"error": str(e)}))
        raise HTTPException(
            status_code=500, detail=f"Error retrieving next witness: {str(e)}"
        )

@app.get("/smt/assess-assignment/", response_model=None)
def assess_assignment(check: str, p: str):
    code = ''
    teacher_reference = ''
    try:
        check = check.upper()
        if check == "SMT":
            url = f"{API_URL}api/permalink/?check={check}&p={p}"
            res = requests.get(url)
            code = res.json().get("code")
            teacher_reference = res.json().get("reference")
    except Exception:
        raise HTTPException(status_code=404, detail="Permalink not found")

    logic = get_logic_from_smt2(teacher_reference)
    solver_teacher = SolverFor(logic) if logic else Solver()
    solver_teacher.from_string(teacher_reference)
    assertions_teacher = solver_teacher.assertions()

    logic = get_logic_from_smt2(code)
    solver_student = SolverFor(logic) if logic else Solver()
    solver_student.from_string(code)
    assertions_student = solver_student.assertions()

    sound = check_soundness(code, assertions_student, assertions_teacher)
    complete = check_completeness(code, assertions_student,  assertions_teacher)
    equivalence = True if sound['result'] == 'unsat' and complete['result'] == 'unsat' else False

    return {'soundness': sound, 'completeness': complete, 'equivalence': equivalence}


@app.get("/smt/generate-assignment/", response_model=None)
def generate_assignment(check: str, p: str):
    code = get_code_by_permalink(check, p)
    try:
        # Determine logic from the script
        logic =  get_logic_from_smt2(code)

        # Create a solver and load the script
        solver = SolverFor(logic) if logic else Solver()
        solver.from_string(code)
        z3_assertions = solver.assertions()

        assertions = [
            f"(assert ({a.sexpr()}))" if not (a.sexpr().startswith("(") and a.sexpr().endswith(")"))
            else f"(assert {a.sexpr()})"
            for a in z3_assertions
        ]

        lines_no_assertions = []
        stack = 0
        is_skipping = False

        for line in code.splitlines():
            tokens = line.strip().lower().replace('(', '( ', 1).split()

            if not is_skipping and len(tokens) >= 2:
                if tokens[0] == '(' and tokens[1] == "assert":
                    is_skipping = True

            if is_skipping:
                stack += line.count("(")
                stack -= line.count(")")

                if stack <= 0:
                    is_skipping = False
                    stack = 0
                continue

            lines_no_assertions.append(line.strip())

        code_no_assertions = "\n".join(l for l in lines_no_assertions if l.strip())

        try:
            if assertions:
                log_to_db(p, json.dumps({"analysis": "generate_assignment", "extracted_assertions_count": len(assertions)}))
        except Exception:
            pass

        # Return the extracted assertions and a version of the script without them
        return {"assertions": assertions, "code_without_assertions": code_no_assertions}
        
    except Exception as e:
        log_to_db(p, json.dumps({"error": str(e)}))
        raise HTTPException(status_code=500, detail=f"Error generating assignment: {str(e)}")
