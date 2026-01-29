from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image
from PyPDF2 import PdfMerger
import io
import os

# Optional HEIC/HEIF support
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:
    pass

app = FastAPI()

# In dev, allow React dev server. In production, set this to your real domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_OUT = {"jpg", "jpeg", "png", "webp", "bmp", "tiff"}



@app.get("/")
def root():
    return {"status": "ok", "message": "API running. Go to /docs"}


@app.post("/convert-image")
async def convert_image(
    file: UploadFile = File(...),
    out: str = Form(...),
    quality: int = Form(90),
):
    out = out.lower()
    if out not in ALLOWED_OUT:
        raise HTTPException(400, f"Unsupported output format: {out}")

    data = await file.read()
    try:
        img = Image.open(io.BytesIO(data))
    except Exception as e:
        raise HTTPException(400, f"Could not read image: {e}")

    # JPEG doesn't support transparency
    if out in {"jpg", "jpeg"}:
        if img.mode in ("RGBA", "LA") or ("transparency" in img.info):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            rgba = img.convert("RGBA")
            bg.paste(rgba, mask=rgba.split()[-1])
            img = bg
        else:
            img = img.convert("RGB")

    buf = io.BytesIO()
    save_kwargs = {}
    if out in {"jpg", "jpeg", "webp"}:
        save_kwargs["quality"] = max(1, min(int(quality), 100))

    pil_format = "JPEG" if out in {"jpg", "jpeg"} else out.upper()
    img.save(buf, format=pil_format, **save_kwargs)
    buf.seek(0)

    filename_base = os.path.splitext(file.filename or "image")[0]
    ext = "jpg" if out in {"jpg", "jpeg"} else out
    out_name = f"{filename_base}.{ext}"

    mime = "image/jpeg" if ext == "jpg" else f"image/{ext}"

    return StreamingResponse(
        buf,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
    )


@app.post("/merge-pdfs")
async def merge_pdfs(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(400, "Upload at least 2 PDFs.")

    merger = PdfMerger()
    try:
        for f in files:
            if not (f.filename or "").lower().endswith(".pdf"):
                raise HTTPException(400, f"Not a PDF: {f.filename}")
            merger.append(io.BytesIO(await f.read()))

        out = io.BytesIO()
        merger.write(out)
        merger.close()
        out.seek(0)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Could not merge PDFs: {e}")

    return StreamingResponse(
        out,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="merged.pdf"'},
    )
