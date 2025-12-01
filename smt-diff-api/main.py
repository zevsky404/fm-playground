import json
import os
from typing import Any, Dict, Union

import requests
import smt_diff.smt_diff as smt_diff
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

API_URL = os.getenv("API_URL")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_code_by_permalink(check: str, p: str) -> Union[str, None]:
    try:
        if check == "SMTSemDiff" or check == "SMT":
            url = f"{API_URL}api/permalink/?check={check}&p={p}"
            res = requests.get(url)
            code = res.json().get("code")
            return code
    except Exception:
        raise HTTPException(status_code=404, detail="Permalink not found")


def get_metadata_by_permalink(check: str, p: str) -> Union[Dict[str, Any], None]:
    try:
        if check == "SMTSemDiff":
            url = f"{API_URL}api/metadata?check={check}&p={p}"
            res = requests.get(url)
            return res.json()
    except Exception:
        raise HTTPException(status_code=404, detail="Permalink not found")


def get_code_by_id(code_id) -> Union[Dict[str, Any], None]:
    try:
        url = f"{API_URL}api/code/{code_id}"
        res = requests.get(url)
        return res.json()
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


class SmtDiffRequest(BaseModel):
    """Request model for starting witness enumeration."""

    check: str  # SMTSemDiff
    p: str  # Permalink
    analysis: str  # current-vs-left, left-vs-current, common
    filter: str = ""  # Optional filter expression


class SmtDiffResponse(BaseModel):
    """Response model for starting enumeration."""

    specId: str
    witness: str


# --------------------------------------------------

@app.get("/health")
def health():
    return {"status": "UP"}

@app.get("/run/", response_model=SmtDiffResponse)
async def run_smt_diff(check: str, p: str, analysis: str, filter: str = ""):
    try:
        current_spec = get_code_by_permalink(check, p)
        previous_metadata = get_metadata_by_permalink(check, p)
        left_side_code_id = (
            json.loads(previous_metadata).get("meta", {}).get("leftSideCodeId")
        )
        previous_spec = get_code_by_id(left_side_code_id).get("code")

        if analysis == "not-previous-but-current":
            specId = smt_diff.store_witness(
                previous_spec, current_spec, analysis=analysis, filter=filter
            )
            first_witness = smt_diff.get_next_witness(specId)
            if first_witness is None:
                raise HTTPException(
                    status_code=404,
                    detail="No diff witnesses found",
                )
        elif analysis == "not-current-but-previous":
            # s2 previous and s1 current
            specId = smt_diff.store_witness(
                previous_spec, current_spec, analysis=analysis, filter=filter
            )
            first_witness = smt_diff.get_next_witness(specId)
            if first_witness is None:
                raise HTTPException(
                    status_code=404,
                    detail="No diff witnesses found",
                )
        elif analysis == "common-witness":
            specId = smt_diff.store_witness(
                previous_spec, current_spec, analysis=analysis, filter=filter
            )
            first_witness = smt_diff.get_next_witness(specId)
            if first_witness is None:
                raise HTTPException(
                    status_code=404,
                    detail="No common witnesses found",
                )
        elif analysis == "semantic-relation":
            sem_relation = smt_diff.get_semantic_relation(current_spec, previous_spec)
            specId = None
            if sem_relation is None:
                raise HTTPException(
                    status_code=404,
                    detail="No semantic relation witnesses found",
                )
            log_to_db(
                p,
                json.dumps(
                    {
                        "tool": "SMTSemDiff-Run",
                        "analysis": analysis,
                    }
                ),
            )
            return SmtDiffResponse(specId="semantic-relation", witness=sem_relation)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid mode: {analysis}. Supported modes: current-vs-left, left-vs-current, common",
            )
        log_to_db(
            p,
            json.dumps(
                {
                    "tool": "SMTSemDiff-Run",
                    "analysis": analysis,
                    "specId": specId,
                }
            ),
        )
        return SmtDiffResponse(specId=specId, witness=first_witness)
    except HTTPException:
        raise
    except Exception as e:
        log_to_db(
            p,
            json.dumps(
                {
                    "tool": "SMTSemDiff-Run",
                    "analysis": analysis,
                    "error": str(e),
                }
            ),
        )
        raise HTTPException(
            status_code=500, detail=f"Error starting enumeration: {str(e)}"
        )


@app.get("/next/{specId}", response_model=SmtDiffResponse)
async def get_next_witness(specId: str, p: str):
    try:
        cache_info = smt_diff.get_cache_info(specId)
        if cache_info is None:
            raise HTTPException(
                status_code=404, detail=f"Cache not found or expired: {specId}"
            )
        next_witness = smt_diff.get_next_witness(specId)

        if next_witness is None:
            raise HTTPException(
                status_code=404, detail="No more witnesses or cache exhausted"
            )
        log_to_db(
            p,
            json.dumps(
                {
                    "tool": "SMTSemDiff-Next",
                    "specId": specId,
                }
            ),
        )
        return SmtDiffResponse(specId=specId, witness=next_witness)
    except HTTPException:
        raise
    except Exception as e:
        log_to_db(p, json.dumps({"error": str(e)}))
        raise HTTPException(
            status_code=500, detail=f"Error retrieving next witness: {str(e)}"
        )
