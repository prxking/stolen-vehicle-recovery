from fastapi import FastAPI, Request  # type: ignore
from fastapi.responses import HTMLResponse  # type: ignore
from fastapi.templating import Jinja2Templates  # type: ignore
from service import get_vehicle_logs  # type: ignore
import os  # type: ignore

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    logs = get_vehicle_logs()
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "logs": logs}
    )
