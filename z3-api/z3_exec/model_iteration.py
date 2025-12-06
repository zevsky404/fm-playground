import multiprocessing
import queue
import threading
from typing import Any, Dict, List, Optional

from utils.helper import (
    get_all_vars,
    get_logic_from_smt2,
    prettify_error,
    prettify_warning,
)
from utils.logics_filter import Z3_SUPPORTED_LOGICS
from utils.z3_cache_manager import cache_manager
from z3 import *

TIMEOUT = 10  # seconds


def all_smt(s: Solver, vars: list):
    def block_term(s, m, t):
        s.add(t != m.eval(t, model_completion=True))

    def fix_term(s, m, t):
        s.add(t == m.eval(t, model_completion=True))

    def all_smt_rec(terms):
        if sat == s.check():
            m = s.model()
            yield m
            for i in range(len(terms)):
                s.push()
                block_term(s, m, terms[i])
                for j in range(i):
                    fix_term(s, m, terms[j])
                yield from all_smt_rec(terms[i:])
                s.pop()

    yield from all_smt_rec(list(vars))


def get_next_model(specId: str, timeout: int = TIMEOUT):
    """
    Get next model from cache with thread-based timeout protection.
    # FIXME: Multiprocessing can't share generators across processes and the thread-based
    # timeout here is a workaround but not ideal.
    """
    result_queue = queue.Queue()
    exception_queue = queue.Queue()

    def worker():
        try:
            model = cache_manager.get_next(specId)

            if model is None:
                exception_queue.put(Exception("No model found"))
                return

            logic = (
                cache_manager.caches[specId].logic
                if specId in cache_manager.caches
                else None
            )

            if isinstance(model, str):
                result_queue.put(model)
            else:
                model_str = model.sexpr()
                if logic:
                    model_str = logic + "\n" + model_str
                result_queue.put(model_str)

        except Exception as e:
            exception_queue.put(e)

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    thread.join(timeout)

    if thread.is_alive():
        # Thread is still running - timed out
        raise Exception(f"Get next model timed out after {timeout} seconds")

    # Check for exceptions
    if not exception_queue.empty():
        raise exception_queue.get()

    # Get result
    if result_queue.empty():
        raise Exception("No result returned from worker thread")

    return result_queue.get()


def _compute_models_worker(queue, spec: str):
    try:
        error_msg = None
        try:
            assertions = parse_smt2_string(spec)
        except Z3Exception as e:
            error_msg = prettify_error(e.args[0].decode())

        if error_msg:
            queue.put({"type": "error", "message": error_msg, "logic": ""})
            return

        logic = get_logic_from_smt2(spec)
        logic_msg = None

        if logic is None or logic not in Z3_SUPPORTED_LOGICS:
            logic_msg = prettify_warning(
                "; No logic specified or unsupported logic, using default solver settings."
            )

        solver = SolverFor(logic) if logic else Solver()
        solver.add(assertions)

        if solver.check() == sat:
            # Return both display logic and actual logic
            all_vars = list(get_all_vars(assertions))
            queue.put(
                {
                    "type": "sat",
                    "spec": spec,
                    "vars": [v.sexpr() for v in all_vars],  # Serialize variables
                }
            )
        else:
            error_msg = prettify_warning("; No model found.")
            queue.put(
                {
                    "type": "unsat",
                    "message": error_msg,
                    "logic": logic_msg if logic_msg else logic,
                }
            )
    except Exception as e:
        queue.put({"type": "exception", "message": str(e)})


def iterate_models(code: str, timeout: int = TIMEOUT) -> Optional[str]:
    """Run model iteration with timeout protection using multiprocessing spawn context"""
    ctx = multiprocessing.get_context("spawn")
    result_queue = ctx.Queue()
    process = ctx.Process(target=_compute_models_worker, args=(result_queue, code))
    process.start()
    process.join(timeout)

    if process.is_alive():
        # Process timed out - kill it
        process.terminate()
        process.join()
        error_msg = prettify_warning(f"; Operation timed out after {timeout} seconds")
        specId = cache_manager.create_cache(
            cached_value=error_msg,
            logic="",
            ttl_seconds=3600,
        )
        return specId

    # Get result from subprocess
    if result_queue.empty():
        error_msg = prettify_error("; Subprocess failed to return result")
        specId = cache_manager.create_cache(
            cached_value=error_msg,
            logic="",
            ttl_seconds=3600,
        )
        return specId

    result = result_queue.get()

    if result["type"] == "error":
        specId = cache_manager.create_cache(
            cached_value=result["message"],
            logic=result["logic"],
            ttl_seconds=3600,
        )
        return specId

    elif result["type"] == "sat":
        # Recreate solver in parent process to create generator
        try:
            assertions = parse_smt2_string(result["spec"])
            logic = get_logic_from_smt2(result["spec"])
            logic_msg = ""
            if logic is None or logic not in Z3_SUPPORTED_LOGICS:
                logic_msg = prettify_warning(
                    "; No logic specified or unsupported logic, using default solver settings."
                )
            solver = SolverFor(logic) if logic else Solver()
            solver.add(assertions)

            # Verify it's still SAT (it should be)
            if solver.check() == sat:
                all_vars = list(get_all_vars(assertions))
                generator = all_smt(solver, all_vars)
                specId = cache_manager.create_cache(
                    cached_value=generator,
                    logic=logic_msg,
                    ttl_seconds=3600,
                )
                return specId
            else:
                # This shouldn't happen, but handle it
                error_msg = prettify_warning("; Solver state changed - no model found")
                specId = cache_manager.create_cache(
                    cached_value=error_msg,
                    logic=logic_msg,
                    ttl_seconds=3600,
                )
                return specId
        except Exception as e:
            error_msg = prettify_error(f"; Error creating cache: {str(e)}")
            specId = cache_manager.create_cache(
                cached_value=error_msg,
                logic="",
                ttl_seconds=3600,
            )
            return specId

    elif result["type"] == "unsat":
        specId = cache_manager.create_cache(
            cached_value=result["message"],
            logic=result["logic"],
            ttl_seconds=3600,
        )
        return specId

    else:  # exception
        error_msg = prettify_error(f"; Error: {result.get('message', 'Unknown error')}")
        specId = cache_manager.create_cache(
            cached_value=error_msg,
            logic="",
            ttl_seconds=3600,
        )
        return specId


def get_cache_info(specId: str):
    return cache_manager.get_cache_info(specId)


def delete_cache(specId: str) -> bool:
    return cache_manager.delete_cache(specId)


def list_all_caches() -> List[Dict[str, Any]]:
    return cache_manager.list_caches()
