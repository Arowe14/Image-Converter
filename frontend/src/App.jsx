import { useMemo, useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import "./App.css";

const API = import.meta.env.VITE_API_URL;

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function Card({ title, subtitle, children }) {
  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="cardTitle">{title}</div>
          {subtitle && <div className="cardSubtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="cardBody">{children}</div>
    </div>
  );
}

function DropArea({ label, accept, multiple = false, onFiles, hint, disabled }) {
  const onDrop = useCallback(
    (acceptedFiles) => {
      if (disabled) return;
      onFiles(acceptedFiles);
    },
    [onFiles, disabled]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    multiple,
    disabled,
  });

  return (
    <div
      className={[
        "drop",
        isDragActive ? "dropActive" : "",
        isDragReject ? "dropReject" : "",
        disabled ? "dropDisabled" : "",
      ].join(" ")}
      {...getRootProps()}
    >
      <input {...getInputProps()} />
      <div className="dropLabel">{label}</div>
      <div className="dropHint">{isDragActive ? "Drop files here…" : hint}</div>
    </div>
  );
}

export default function App() {
  const [imgFile, setImgFile] = useState(null);
  const [outFmt, setOutFmt] = useState("jpg");
  const [quality, setQuality] = useState(90);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgMsg, setImgMsg] = useState("");

  const [pdfFiles, setPdfFiles] = useState([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMsg, setPdfMsg] = useState("");

  const imgBaseName = useMemo(() => {
    if (!imgFile?.name) return "output";
    return imgFile.name.replace(/\.[^/.]+$/, "");
  }, [imgFile]);

  const imgPreviewUrl = useMemo(() => {
    if (!imgFile) return null;
    return URL.createObjectURL(imgFile);
  }, [imgFile]);

  useEffect(() => {
    return () => {
      if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
    };
  }, [imgPreviewUrl]);

  async function handleConvert() {
    if (!imgFile) return alert("Pick an image first.");

    setImgBusy(true);
    setImgMsg("");
    try {
      const fd = new FormData();
      fd.append("file", imgFile);
      fd.append("out", outFmt);
      fd.append("quality", String(quality));

      const res = await fetch(`${API}/convert-image`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const ext = outFmt === "jpeg" ? "jpg" : outFmt;
      downloadBlob(blob, `${imgBaseName}.${ext}`);
      setImgMsg("Done. Download started.");
    } catch (e) {
      setImgMsg(String(e));
    } finally {
      setImgBusy(false);
    }
  }

  async function handleMerge() {
    if (pdfFiles.length < 2) return alert("Pick at least 2 PDFs.");

    setPdfBusy(true);
    setPdfMsg("");
    try {
      const fd = new FormData();
      pdfFiles.forEach((f) => fd.append("files", f));

      const res = await fetch(`${API}/merge-pdfs`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      downloadBlob(blob, "merged.pdf");
      setPdfMsg("Merged. Download started.");
    } catch (e) {
      setPdfMsg(String(e));
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="viewport">
      <div className="scaleWrap">
        <div className="page">
          <header className="header">
            <div className="brand">
              <div className="logo">⇄</div>
              <div>
                <div className="brandName">Convert & Merge</div>
                <div className="brandTag">Images + PDFs, fast and simple</div>
              </div>
            </div>
          </header>

          <main className="grid">
            <Card title="Image Converter" subtitle="Drag an image in, choose output format, download the result.">
              <DropArea
                label={imgFile ? "Replace image" : "Drop an image here"}
                accept={{ "image/*": [] }}
                multiple={false}
                disabled={imgBusy}
                onFiles={(files) => {
                  setImgFile(files[0] || null);
                  setImgMsg("");
                }}
                hint="or click to browse"
              />

              {imgFile && (
                <div className="fileRow">
                  <div className="fileMeta">
                    <div className="fileName">{imgFile.name}</div>
                    <div className="fileSub">
                      {formatBytes(imgFile.size)} • {imgFile.type || "unknown type"}
                    </div>
                  </div>
                  {imgPreviewUrl && <img className="thumb" src={imgPreviewUrl} alt="preview" />}
                </div>
              )}

              <div className="controls">
                <label className="control">
                  <span>Output</span>
                  <select value={outFmt} onChange={(e) => setOutFmt(e.target.value)} disabled={imgBusy}>
                    <option value="jpg">JPG</option>
                    <option value="png">PNG</option>
                    <option value="webp">WEBP</option>
                    <option value="bmp">BMP</option>
                    <option value="tiff">TIFF</option>
                  </select>
                </label>

                <label className="control">
                  <span>Quality (JPG/WEBP)</span>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    disabled={imgBusy || outFmt === "png" || outFmt === "bmp" || outFmt === "tiff"}
                  />
                  <div className="rangeVal">{quality}</div>
                </label>
              </div>

              <button className="primary" onClick={handleConvert} disabled={!imgFile || imgBusy}>
                {imgBusy ? "Converting…" : "Convert & Download"}
              </button>

              <div className="note">
                JPG can’t keep transparency; transparent images will get a white background.
              </div>

              {imgMsg && <div className="status">{imgMsg}</div>}
            </Card>

            <Card title="Merge PDFs" subtitle="Drag multiple PDFs in (order matters), then merge into one.">
              <DropArea
                label={pdfFiles.length ? "Add/replace PDFs" : "Drop PDFs here"}
                accept={{ "application/pdf": [".pdf"] }}
                multiple={true}
                disabled={pdfBusy}
                onFiles={(files) => {
                  setPdfFiles(files);
                  setPdfMsg("");
                }}
                hint="or click to browse (select 2+ files)"
              />

              {pdfFiles.length > 0 && (
                <div className="list">
                  {pdfFiles.map((f, idx) => (
                    <div className="listItem" key={`${f.name}-${idx}`}>
                      <div className="badge">{idx + 1}</div>
                      <div className="listMain">
                        <div className="fileName">{f.name}</div>
                        <div className="fileSub">{formatBytes(f.size)}</div>
                      </div>
                      <button
                        className="ghost"
                        onClick={() => setPdfFiles((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={pdfBusy}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="row">
                <button className="primary" onClick={handleMerge} disabled={pdfFiles.length < 2 || pdfBusy}>
                  {pdfBusy ? "Merging…" : "Merge & Download"}
                </button>

                <button className="secondary" onClick={() => setPdfFiles([])} disabled={pdfBusy || pdfFiles.length === 0}>
                  Clear
                </button>
              </div>

              {pdfMsg && <div className="status">{pdfMsg}</div>}
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}
