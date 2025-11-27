import os
import shutil
import tempfile
import traceback
import json
from typing import Union

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from starlette.background import BackgroundTask
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dafny_exec.dafny import run_dafny, verify_dafny, translate_dafny

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


def log_to_db(p: str, result: str):
    try:
        url = f"{API_URL}api/analysis/log"
        payload = {"permalink": p, "result": result}
        headers = {"Content-Type": "application/json"}
        requests.post(url, json=payload, headers=headers)
    except Exception:
        pass


def cleanup_translation_files_sync(zip_path: str, permalink: str, target_language: str):
    """Cleanup translation files after response is sent or on error"""
    tmp_dir = tempfile.gettempdir()
    dfy_path = os.path.join(tmp_dir, f"{permalink}.dfy")

    try:
        # Remove zip file
        if zip_path and os.path.exists(zip_path):
            os.remove(zip_path)

        # Remove original dfy file
        if os.path.exists(dfy_path):
            os.remove(dfy_path)

        # Remove output directory or files
        if target_language in ["py", "java", "go"]:
            output_dir = os.path.join(tmp_dir, f"{permalink}-{target_language}")
            if os.path.exists(output_dir):
                shutil.rmtree(output_dir)
        elif target_language in ["cs", "js"]:
            base_file = os.path.join(tmp_dir, f"{permalink}.{target_language}")
            dtr_file = os.path.join(tmp_dir, f"{permalink}-{target_language}.dtr")
            if os.path.exists(base_file):
                os.remove(base_file)
            if os.path.exists(dtr_file):
                os.remove(dtr_file)
    except Exception as e:
        log_to_db(permalink, json.dumps({"/dfy/ - cleanup_error": str(e)}))


def get_code_by_permalink(check: str, p: str) -> Union[str, None]:
    try:
        check = check.upper()
        if check == "DFY":
            url = f"{API_URL}api/permalink/?check={check}&p={p}"
            res = requests.get(url)
            code = res.json().get("code")
            return code
    except Exception:
        raise HTTPException(status_code=404, detail="Permalink not found")


# ------------- Dafny Endpoints -------------


@app.get("/dfy/verify/", response_model=None)
def code_verify(check: str, p: str):
    if not check or not p:
        raise HTTPException(status_code=400, detail="Invalid query parameters")
    code = get_code_by_permalink(check, p)
    try:
        return verify_dafny(code)
    except Exception as e:
        log_to_db(p, json.dumps({"/dfy/verify/ - error": str(e)}))
        error_detail = f"Error verifying dafny code: {str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


@app.get("/dfy/run/", response_model=None)
def code(check: str, p: str):
    if not check or not p:
        raise HTTPException(status_code=400, detail="Invalid query parameters")
    code = get_code_by_permalink(check, p)
    try:
        return run_dafny(code)
    except Exception as e:
        log_to_db(p, json.dumps({"/dfy/run/ - error": str(e)}))
        # Include the exception message (which may contain Dafny stdout/stderr)
        error_detail = f"Error running code: {str(e)}"
        raise HTTPException(status_code=500, detail=error_detail)


@app.get("/dfy/translate/{target_language}", response_model=None)
def translate_to_python(check: str, p: str, target_language: str):
    if not check or not p:
        raise HTTPException(status_code=400, detail="Invalid query parameters")

    # Validate target language
    valid_languages = ["py", "cs", "java", "go", "js"]
    if target_language not in valid_languages:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid target language. Must be one of: {', '.join(valid_languages)}",
        )

    code = get_code_by_permalink(check, p)
    zip_path = None

    try:
        zip_path = translate_dafny(code, p, target_language)
        # Return the zip file with cleanup
        return FileResponse(
            path=zip_path,
            filename=f"{p}-{target_language}.zip",
            media_type="application/zip",
            background=BackgroundTask(
                cleanup_translation_files_sync, zip_path, p, target_language
            ),
        )
    except Exception as e:
        # Clean up on error
        cleanup_translation_files_sync(zip_path, p, target_language)
        log_to_db(p, json.dumps({"/dfy/translate/ - error": str(e)}))

        error_detail = f"Error translating code: {str(e)}"
        raise HTTPException(status_code=500, detail=str(e))
