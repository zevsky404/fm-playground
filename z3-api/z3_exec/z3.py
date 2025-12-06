import concurrent.futures
import multiprocessing
import os
import queue
import subprocess
import tempfile

from dotenv import load_dotenv
from smt_redundancy.redundancy import unsat_core
from utils.helper import get_logic_from_smt2, prettify_warning
from z3 import *

load_dotenv()

MAX_CONCURRENT_REQUESTS = 10
TIMEOUT = 30  # seconds

DEV_ENV = os.getenv("DEV_ENV", "False")
executor = concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENT_REQUESTS)
code_queue = queue.Queue()


def run_z3(code: str) -> str:
    tmp_file = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".smt2")
    tmp_file.write(code.strip())
    tmp_file.close()
    if DEV_ENV.lower() == "true":
        command = ["z3", "-smt2", tmp_file.name]
    else:
        command = ["/usr/bin/z3", "-smt2", tmp_file.name]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=20)
        os.remove(tmp_file.name)
        return result.stdout
    except subprocess.TimeoutExpired:
        os.remove(tmp_file.name)
        return "Process timed out after {} seconds".format(20)


def at_least_one_sat(model: str) -> bool:
    """
    Check if any line in the model contains 'sat'.
    Returns 'sat' if found, otherwise 'unsat'.
    """
    lines = model.split("\n")
    for line in lines:
        if "sat" in line.lower():
            return True
    return False


def _check_redundancy_worker(result_queue, code: str):
    """Worker function to run redundancy check in a separate process"""
    try:
        logic = get_logic_from_smt2(code)
        solver = SolverFor(logic) if logic else Solver()
        solver.from_string(code)
        redundant_lines = list(unsat_core(solver, solver.assertions(), smt2_file=code))
        if logic is None:
            warning_msg = prettify_warning(
                "No logic specified or unsupported logic, using default solver settings."
            )
            result_queue.put((f"{warning_msg}\n", redundant_lines))
            return
        result_queue.put(("", redundant_lines))
    except Exception as e:
        result_queue.put((str(e), []))


def _run_z3_with_redundancy_worker(result_queue, code: str):
    """Worker function to run Z3 with redundancy detection in a separate process"""
    try:
        res = run_z3(code)
        logic = get_logic_from_smt2(code)
        if not at_least_one_sat(res):
            result_queue.put((res, []))
            return
        try:
            solver = SolverFor(logic) if logic else Solver()
            solver.from_string(code)
            redundant_lines = list(
                unsat_core(solver, solver.assertions(), smt2_file=code)
            )
        except Exception:
            redundant_lines = []
        if logic is None:
            res = f"{prettify_warning('No logic specified or unsupported logic, using default solver settings.')}\n{res}"

        result_queue.put((res, redundant_lines))
    except Exception as e:
        result_queue.put((None, str(e), []))


def run_with_timeout(worker_func, code: str, timeout=TIMEOUT):
    """Run a worker function with timeout using multiprocessing.

    Use the 'spawn' start method to avoid deadlocks on platforms (Linux)
    where the default 'fork' start method can interact badly with threads.
    """
    # use a spawn context for safety (avoids forking threads/locks)
    ctx = multiprocessing.get_context("spawn")
    result_queue = ctx.Queue()
    process = ctx.Process(target=worker_func, args=(result_queue, code))
    process.start()
    process.join(timeout)

    if process.is_alive():
        # Process timed out - terminate and return timeout marker
        process.terminate()
        process.join()
        return f"Process timed out after {timeout} seconds", []

    # Get result from queue
    if not result_queue.empty():
        return result_queue.get()
    else:
        return "No result returned", []


def check_redundancy_only(code: str):
    """Check redundancy with timeout protection using multiprocessing"""
    return run_with_timeout(_check_redundancy_worker, code, timeout=TIMEOUT)


def execution_queue(code: str):
    code_queue.put(code)
    while True:
        code_command = code_queue.get()
        if code_command is None:
            break
        ex = executor.submit(
            run_with_timeout, _run_z3_with_redundancy_worker, code_command, 15
        )
        return ex.result()
