import json
import os
from typing import Optional, Union

import redis
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from redis_cache import RedisCache
from z3 import SolverFor, Solver
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
    
@app.get("/smt/generate-assignment/", response_model=None)
def generate_assignment(check: str, p: str):
    code = get_code_by_permalink(check, p)
    try:
        # Extract assertions from the SMT-LIB script and produce a code string
        # without assertions
        def extract_assertions(spec: str):
            """
            Return (assertions_list, spec_without_assertions).
            This scans the SMT-LIB script for top-level '(assert ...)'
            and extracts them while preserving the rest of the script. It
            performs a simple balanced-parentheses scan and is resilient to
            parentheses inside strings and nested expressions.
            """
            assertions = []
            i = 0
            n = len(spec)
            # Work on a mutable copy
            s = spec
            while True:
                idx = s.find("(assert", i)
                if idx == -1:
                    break
                # Find the start of the assertion (the '(' at idx)
                start = idx
                j = start
                depth = 0
                in_string = False
                end = None
                while j < n:
                    ch = s[j]
                    # Handle string delimiters to avoid counting parentheses inside strings
                    if ch == '"' and (j == 0 or s[j - 1] != "\\"):
                        in_string = not in_string
                    if not in_string:
                        if ch == '(':
                            depth += 1
                        elif ch == ')':
                            depth -= 1
                            if depth == 0:
                                end = j + 1
                                break
                    j += 1
                if end is None:
                    # Unbalanced parentheses: take to end
                    end = n
                assertion = s[start:end]
                assertions.append(assertion)
                # Remove the assertion from the script, replace with a newline
                s = s[:start] + "\n" + s[end:]
                # Reset indices to continue scanning after start
                i = start
                n = len(s)

            return assertions, s

        assertions, code_no_assertions = extract_assertions(code)

        # Determine logic from the script without assertions first (safer),
        # fall back to original script if needed.
        logic = get_logic_from_smt2(code_no_assertions) or get_logic_from_smt2(code)

        # Create a solver and load the full script (including assertions) so
        # behavior remains consistent with prior implementation.
        solver = SolverFor(logic) if logic else Solver()
        solver.from_string(code_no_assertions)
        solver.assertions()

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
