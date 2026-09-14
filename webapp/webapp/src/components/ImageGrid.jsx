import React, { useState, useRef, useEffect } from "react";
import { storageImageUrl } from "../lib/storageImages.js";

const PEN_COLORS = [
  { name: "노랑", value: "rgba(255, 224, 0, 0.45)" },
  { name: "분홍", value: "rgba(255, 105, 180, 0.4)" },
  { name: "초록", value: "rgba(80, 220, 100, 0.4)" },
  { name: "하늘", value: "rgba(80, 170, 255, 0.4)" },
];
const PEN_WIDTH_MIN = 2;
const PEN_WIDTH_MAX = 40;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

export default function ImageGrid({ filenames, label, onAllBroken }) {
  const [openIndex, setOpenIndex] = useState(null);
  const [broken, setBroken] = useState({});

  if (!filenames || filenames.length === 0) return null;

  const visibleNames = filenames.filter((name) => !broken[name]);

  useEffect(() => {
    if (filenames.length > 0 && visibleNames.length === 0 && onAllBroken) {
      onAllBroken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNames.length]);

  if (visibleNames.length === 0) return null;

  return (
    <div className="image-grid-wrap">
      {label && <div className="image-grid-label">{label}</div>}
      <div className="image-grid">
        {visibleNames.map((name) => (
          <button
            key={name}
            type="button"
            className="image-grid-thumb"
            onClick={() => setOpenIndex(visibleNames.indexOf(name))}
          >
            <img
              src={storageImageUrl(name)}
              alt=""
              loading="lazy"
              onError={() => setBroken((prev) => ({ ...prev, [name]: true }))}
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <Lightbox
          filenames={visibleNames}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}

function Lightbox({ filenames, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [penOn, setPenOn] = useState(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value);
  const [penWidth, setPenWidth] = useState(10); // 캔버스 폭 기준 px (아래에서 비율로 저장/환산)
  const [zoom, setZoom] = useState(1);

  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const drawing = useRef(false);
  // 확대/축소해도 그림이 안 깨지도록, 모든 좌표와 굵기는 "이미지 폭 대비 비율"로 저장한다.
  const strokesRef = useRef([]); // [{ color, widthRatio, points: [{xR, yR}, ...] }]
  const currentStrokeRef = useRef(null);

  const src = storageImageUrl(filenames[index]);

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokesRef.current) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.widthRatio * canvas.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      stroke.points.forEach((p, i) => {
        const x = p.xR * canvas.width;
        const y = p.yR * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  function syncCanvasSize() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    redraw();
  }

  // 이미지 크기가 바뀔 때마다(확대/축소, 창 크기 변경, 최초 로드) 캔버스를 다시 맞추고 그림을 재생.
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const ro = new ResizeObserver(() => syncCanvasSize());
    ro.observe(img);
    return () => ro.disconnect();
  }, [index]);

  useEffect(() => {
    strokesRef.current = [];
    setZoom(1);
  }, [index]);

  function clearCanvas() {
    strokesRef.current = [];
    redraw();
  }

  function pointerRatio(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      xR: (e.clientX - rect.left) / rect.width,
      yR: (e.clientY - rect.top) / rect.height,
    };
  }

  function handlePointerDown(e) {
    if (!penOn) return;
    drawing.current = true;
    const canvas = canvasRef.current;
    const widthRatio = penWidth / canvas.width;
    currentStrokeRef.current = { color: penColor, widthRatio, points: [pointerRatio(e)] };
    strokesRef.current.push(currentStrokeRef.current);
  }

  function handlePointerMove(e) {
    if (!penOn || !drawing.current) return;
    currentStrokeRef.current.points.push(pointerRatio(e));
    redraw();
  }

  function handlePointerUp() {
    drawing.current = false;
    currentStrokeRef.current = null;
  }

  function zoomIn() {
    setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100));
  }
  function zoomOut() {
    setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100));
  }
  function zoomReset() {
    setZoom(1);
  }

  // zoom=1일 때는 화면에 맞추고(CSS max-width/height), zoom>1이면 자연 크기 기준으로 확대해
  // 스크롤해서 볼 수 있게 한다.
  const imgStyle =
    zoom === 1
      ? {}
      : { width: `${zoom * 100}%`, maxWidth: "none", maxHeight: "none" };

  return (
    <div className="image-lightbox" onClick={onClose}>
      <div className="image-lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`pen-toggle ${penOn ? "active" : ""}`}
          onClick={() => setPenOn((v) => !v)}
        >
          ✏️ 펜 {penOn ? "끄기" : "켜기"}
        </button>
        {penOn && (
          <>
            {PEN_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`pen-color-swatch ${penColor === c.value ? "active" : ""}`}
                style={{ background: c.value.replace(/, [\d.]+\)/, ", 1)") }}
                title={c.name}
                onClick={() => setPenColor(c.value)}
              />
            ))}
            <label className="pen-width-control">
              굵기
              <input
                type="range"
                min={PEN_WIDTH_MIN}
                max={PEN_WIDTH_MAX}
                value={penWidth}
                onChange={(e) => setPenWidth(Number(e.target.value))}
              />
            </label>
            <button type="button" className="pen-clear" onClick={clearCanvas}>
              지우기
            </button>
          </>
        )}
        <span className="toolbar-divider" />
        <button type="button" className="zoom-btn" onClick={zoomOut} disabled={zoom <= ZOOM_MIN}>
          −
        </button>
        <button type="button" className="zoom-btn zoom-reset" onClick={zoomReset}>
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className="zoom-btn" onClick={zoomIn} disabled={zoom >= ZOOM_MAX}>
          +
        </button>
      </div>

      <button type="button" className="image-lightbox-close" onClick={onClose} aria-label="닫기">
        닫기 ✕
      </button>

      <div
        className="image-lightbox-scroll"
        ref={wrapRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="image-lightbox-canvas-wrap"
          style={{ cursor: penOn ? "crosshair" : "default" }}
        >
          <img ref={imgRef} src={src} alt="" style={imgStyle} onLoad={syncCanvasSize} />
          <canvas
            ref={canvasRef}
            className="image-lightbox-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
      </div>

      {filenames.length > 1 && (
        <div className="image-lightbox-nav" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => setIndex((i) => (i - 1 + filenames.length) % filenames.length)}>
            ← 이전
          </button>
          <span>
            {index + 1} / {filenames.length}
          </span>
          <button type="button" onClick={() => setIndex((i) => (i + 1) % filenames.length)}>
            다음 →
          </button>
        </div>
      )}
    </div>
  );
}
