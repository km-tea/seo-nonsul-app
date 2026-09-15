import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getItemShape } from "../lib/itemShape.js";
import TextBlock from "../components/TextBlock.jsx";
import ImageGrid from "../components/ImageGrid.jsx";
import MultiPartAnswer, { emptyPart } from "../components/MultiPartAnswer.jsx";

function serializeBlock(block) {
  if (!block) return "";
  if (block.type === "table" && block.table) {
    const { headers, rows } = block.table;
    const headerLine = "| " + headers.join(" | ") + " |";
    const sepLine = "| " + headers.map(() => "---").join(" | ") + " |";
    const rowLines = rows.map((r) => "| " + r.join(" | ") + " |");
    return [headerLine, sepLine, ...rowLines].join("\n");
  }
  return (block.text || "").trim();
}

function serializeParts(parts, labels) {
  return (parts || [])
    .map((p, i) => {
      const body = serializeBlock(p);
      if (!body) return "";
      const label = labels && labels[i] ? `${i + 1}. ${labels[i]}` : `[답 ${i + 1}]`;
      return `${label}\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function partsHaveContent(parts) {
  return (parts || []).some((p) => {
    if (!p) return false;
    if (p.type === "table" && p.table) {
      return p.table.rows.some((row) => row.some((cell) => cell && cell.trim()));
    }
    return !!(p.text && p.text.trim());
  });
}

export default function SolvePage() {
  const { itemId } = useParams();
  const { supabase, session, student } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const draftKey = student ? `seo-nonsul-draft:${student.id}:${itemId}` : null;

  // raw_content / direct / image_only 용
  const [parts, setParts] = useState([emptyPart()]);
  // staged 용: { [stageNum]: parts[] }
  const [stagePartsMap, setStagePartsMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const { data, error: err } = await supabase
        .from("items")
        .select("*")
        .eq("id", itemId)
        .single();
      if (cancelled) return;
      if (err) {
        setError("문항을 불러오지 못했습니다: " + err.message);
      } else {
        setItem(data);
        const shape = getItemShape(data);
        let initialParts = [emptyPart()];
        if (shape === "direct" && data.question?.conditions?.length) {
          initialParts = data.question.conditions.map(() => emptyPart());
        }
        let initialStageMap = {};
        if (shape === "staged") {
          (data.staged_questions || []).forEach((s) => {
            const n = s.conditions && s.conditions.length ? s.conditions.length : 1;
            initialStageMap[s.stage] = Array.from({ length: n }, emptyPart);
          });
        }

        // 임시저장된 답이 있으면 불러와서 이어 쓸 수 있게 한다.
        if (draftKey) {
          try {
            const raw = localStorage.getItem(draftKey);
            if (raw) {
              const draft = JSON.parse(raw);
              if (draft.parts) initialParts = draft.parts;
              if (draft.stagePartsMap) initialStageMap = draft.stagePartsMap;
            }
          } catch {
            // 임시저장 데이터가 깨져있으면 그냥 무시하고 새로 시작한다.
          }
        }

        setParts(initialParts);
        setStagePartsMap(initialStageMap);
        setDraftLoaded(true);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, itemId]);

  // 답을 쓰는 동안 자동으로 임시저장한다(페이지를 벗어나도 다음에 이어 쓸 수 있게).
  useEffect(() => {
    if (!draftKey || !draftLoaded) return;
    const hasContent = partsHaveContent(parts) || Object.values(stagePartsMap).some(partsHaveContent);
    try {
      if (hasContent) {
        localStorage.setItem(draftKey, JSON.stringify({ parts, stagePartsMap }));
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch {
      // 저장 공간이 꽉 찼거나 하는 경우는 조용히 무시(임시저장은 편의 기능일 뿐이라서)
    }
  }, [draftKey, draftLoaded, parts, stagePartsMap]);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const shape = getItemShape(item);
      let payload;
      if (shape === "staged") {
        const stage_answers = {};
        (item.staged_questions || []).forEach((s) => {
          const stageParts = stagePartsMap[s.stage] || [];
          const labels = s.conditions && s.conditions.length ? s.conditions : null;
          stage_answers[s.stage] = serializeParts(stageParts, labels);
        });
        payload = { item_id: itemId, stage_answers };
      } else {
        const labels = shape === "direct" ? item.question?.conditions : null;
        const answer_text = serializeParts(parts, labels);
        payload = { item_id: itemId, answer_text };
      }

      const res = await fetch("/.netlify/functions/grade-answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "채점 중 문제가 생겼습니다. 다시 시도해 주세요.");
        return;
      }
      navigate(`/items/${itemId}/explain`);
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // 무시해도 되는 실패
        }
      }
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="loading-line">불러오는 중...</p>;
  if (error && !item) return <p className="error-text">{error}</p>;
  if (!item) return null;

  const shape = getItemShape(item);

  let canSubmit = false;
  if (shape === "staged") {
    canSubmit = Object.values(stagePartsMap).some((p) => partsHaveContent(p));
  } else {
    canSubmit = partsHaveContent(parts);
  }

  return (
    <div>
      <div className="solve-header">
        <div className="domain">{item.domain || item.grade_band}</div>
        <h1>{item.title}</h1>
      </div>

      {shape === "raw_content" && <RawContentSolver item={item} parts={parts} setParts={setParts} />}
      {shape === "staged" && (
        <StagedSolver item={item} stagePartsMap={stagePartsMap} setStagePartsMap={setStagePartsMap} />
      )}
      {shape === "direct" && <DirectSolver item={item} parts={parts} setParts={setParts} />}
      {shape === "image_only" && <ImageOnlySolver item={item} parts={parts} setParts={setParts} />}
      {shape === "unknown" && <p>이 문항은 아직 준비 중이에요.</p>}

      {error && <p className="error-text">{error}</p>}

      <div className="submit-row">
        <span className="draft-saved-note">✓ 답안이 자동으로 임시저장돼요</span>
        <button
          className="btn-primary"
          style={{ width: "auto" }}
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? "채점하는 중..." : "제출하고 채점받기"}
        </button>
      </div>
    </div>
  );
}

function RawContentSolver({ item, parts, setParts }) {
  const rc = item.raw_content || {};
  const cleanText = rc.평가문항;
  const messyText = rc.문항;
  const fallbackText = cleanText || messyText;
  const hasImage = item.stimulus_images && item.stimulus_images.length > 0;
  const hasFallbackText = !!(fallbackText && fallbackText.trim());
  const [imageFailed, setImageFailed] = React.useState(false);

  const showImage = hasImage && !imageFailed;
  const showText = !showImage;

  return (
    <div>
      {showImage && (
        <ImageGrid
          filenames={item.stimulus_images}
          label="문제"
          onAllBroken={() => setImageFailed(true)}
        />
      )}
      {showText && (
        <div className="stimulus-box">
          {hasFallbackText ? (
            <TextBlock text={fallbackText} showReadAloud />
          ) : (
            <>
              <TextBlock text={item.title} />
              <p className="missing-content-note">
                이 문항은 상세 지문이 아직 등록되지 않았어요. 제목을 참고해서 답을 써 보세요.
              </p>
            </>
          )}
        </div>
      )}
      <p className="answer-hint">
        문제에 여러 개의 하위 질문이 있다면, 아래 "+ 답 칸 추가"로 나눠서 써 보세요.
      </p>
      <MultiPartAnswer mode="manual" parts={parts} setParts={setParts} />
    </div>
  );
}

function ImageOnlySolver({ item, parts, setParts }) {
  return (
    <div>
      <p className="missing-content-note" style={{ marginTop: 0, marginBottom: 12 }}>
        이 문항은 아래 이미지 안에 문제가 들어있어요. 이미지를 보고 답을 써 보세요.
      </p>
      <ImageGrid filenames={item.stimulus_images} label="문제" />
      <p className="answer-hint">
        문제에 여러 개의 하위 질문이 있다면, 아래 "+ 답 칸 추가"로 나눠서 써 보세요. 표를 채워야
        하면 "표로 쓰기"를 눌러보세요.
      </p>
      <MultiPartAnswer mode="manual" parts={parts} setParts={setParts} />
    </div>
  );
}

function DirectSolver({ item, parts, setParts }) {
  const q = item.question || {};
  const hasContent = !!(q.prompt && q.prompt.trim());
  const conditions = q.conditions && q.conditions.length ? q.conditions : null;

  return (
    <div>
      <div className="stimulus-box">
        {hasContent ? (
          <TextBlock text={q.prompt} showReadAloud />
        ) : (
          <>
            <TextBlock text={item.title} />
            <p className="missing-content-note">
              이 문항은 상세 지문이 아직 등록되지 않았어요. 제목을 참고해서 답을 써 보세요.
            </p>
          </>
        )}
      </div>
      <ImageGrid filenames={item.stimulus_images} label="제시 자료" />
      {item.core_keywords && item.core_keywords.length > 0 && (
        <div className="keyword-hints">
          {item.core_keywords.map((k, i) => (
            <span key={i} className={`kw ${k.required ? "required" : ""}`}>
              {k.keyword}
            </span>
          ))}
        </div>
      )}
      <MultiPartAnswer
        mode={conditions ? "auto" : "manual"}
        labels={conditions}
        parts={parts}
        setParts={setParts}
      />
    </div>
  );
}

function StagedSolver({ item, stagePartsMap, setStagePartsMap }) {
  const stages = item.staged_questions || [];
  return (
    <div>
      <ImageGrid filenames={item.stimulus_images} label="제시 자료" />
      {stages.map((stage) => {
        const hasContent = !!(stage.prompt && stage.prompt.trim());
        const conditions = stage.conditions && stage.conditions.length ? stage.conditions : null;
        const stageParts = stagePartsMap[stage.stage] || [emptyPart()];
        return (
          <div className="stage-block" key={stage.stage}>
            <span className="stage-points">{stage.points}점</span>
            <span className="stage-label">{stage.label}</span>
            {hasContent ? (
              <TextBlock text={stage.prompt} showReadAloud />
            ) : (
              <p className="missing-content-note">
                이 단계는 상세 지문이 아직 등록되지 않았어요. 위 제목을 참고해서 답을 써 보세요.
              </p>
            )}
            <MultiPartAnswer
              mode={conditions ? "auto" : "manual"}
              labels={conditions}
              parts={stageParts}
              setParts={(updater) =>
                setStagePartsMap((prev) => ({
                  ...prev,
                  [stage.stage]:
                    typeof updater === "function" ? updater(prev[stage.stage] || []) : updater,
                }))
              }
            />
          </div>
        );
      })}
    </div>
  );
}
