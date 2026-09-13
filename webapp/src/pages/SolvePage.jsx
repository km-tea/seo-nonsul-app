import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getItemShape } from "../lib/itemShape.js";
import TextBlock from "../components/TextBlock.jsx";
import ImageGrid from "../components/ImageGrid.jsx";

export default function SolvePage() {
  const { itemId } = useParams();
  const { supabase, session } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 단일 답안(raw_content, direct) / 단계별 답안(staged) 공용 상태
  const [answer, setAnswer] = useState("");
  const [stageAnswers, setStageAnswers] = useState({});

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
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, itemId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const shape = getItemShape(item);
      const payload =
        shape === "staged"
          ? { item_id: itemId, stage_answers: stageAnswers }
          : { item_id: itemId, answer_text: answer };

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
  const canSubmit =
    shape === "staged"
      ? Object.values(stageAnswers).some((v) => v && v.trim().length > 0)
      : answer.trim().length > 0;

  return (
    <div>
      <div className="solve-header">
        <div className="domain">{item.domain || item.grade_band}</div>
        <h1>{item.title}</h1>
      </div>

      {shape === "raw_content" && (
        <RawContentSolver item={item} answer={answer} setAnswer={setAnswer} />
      )}
      {shape === "staged" && (
        <StagedSolver item={item} stageAnswers={stageAnswers} setStageAnswers={setStageAnswers} />
      )}
      {shape === "direct" && (
        <DirectSolver item={item} answer={answer} setAnswer={setAnswer} />
      )}
      {shape === "image_only" && (
        <ImageOnlySolver item={item} answer={answer} setAnswer={setAnswer} />
      )}
      {shape === "unknown" && <p>이 문항은 아직 준비 중이에요.</p>}

      {error && <p className="error-text">{error}</p>}

      <div className="submit-row">
        <button className="btn-primary" style={{ width: "auto" }} onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? "채점하는 중..." : "제출하고 채점받기"}
        </button>
      </div>
    </div>
  );
}

function RawContentSolver({ item, answer, setAnswer }) {
  const rc = item.raw_content || {};
  // raw_content는 두 가지 스키마가 섞여 있다:
  //  - KICE/경기 스타일(평가문항 키): 텍스트가 이미 깔끔함
  //  - 초등 일부 배치(문항 키만): PDF에서 그대로 뽑아내 다소 지저분함
  // 이미지가 있으면 항상 이미지를 먼저 시도하고, 실제로 로드에 실패하면(파일명이
  // 안 맞는 등) 자동으로 텍스트로 대체한다.
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
            <TextBlock text={fallbackText} />
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
      <div className="field">
        <label htmlFor="answer">내 답안</label>
        <textarea id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </div>
    </div>
  );
}

function ImageOnlySolver({ item, answer, setAnswer }) {
  return (
    <div>
      <p className="missing-content-note" style={{ marginTop: 0, marginBottom: 12 }}>
        이 문항은 아래 이미지 안에 문제가 들어있어요. 이미지를 보고 답을 써 보세요.
      </p>
      <ImageGrid filenames={item.stimulus_images} label="문제" />
      <div className="field">
        <label htmlFor="answer">내 답안</label>
        <textarea id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </div>
    </div>
  );
}

function DirectSolver({ item, answer, setAnswer }) {
  const q = item.question || {};
  const hasContent = !!(q.prompt && q.prompt.trim());
  return (
    <div>
      <div className="stimulus-box">
        {hasContent ? (
          <TextBlock text={q.prompt} />
        ) : (
          <>
            <TextBlock text={item.title} />
            <p className="missing-content-note">
              이 문항은 상세 지문이 아직 등록되지 않았어요. 제목을 참고해서 답을 써 보세요.
            </p>
          </>
        )}
        {q.conditions && q.conditions.length > 0 && (
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            {q.conditions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
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
      <div className="field">
        <label htmlFor="answer">내 답안</label>
        <textarea id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </div>
    </div>
  );
}

function StagedSolver({ item, stageAnswers, setStageAnswers }) {
  const stages = item.staged_questions || [];
  return (
    <div>
      <ImageGrid filenames={item.stimulus_images} label="제시 자료" />
      {stages.map((stage) => {
        const hasContent = !!(stage.prompt && stage.prompt.trim());
        return (
          <div className="stage-block" key={stage.stage}>
            <span className="stage-points">{stage.points}점</span>
            <span className="stage-label">{stage.label}</span>
            {hasContent ? (
              <TextBlock text={stage.prompt} />
            ) : (
              <p className="missing-content-note">
                이 단계는 상세 지문이 아직 등록되지 않았어요. 위 제목을 참고해서 답을 써 보세요.
              </p>
            )}
            {stage.conditions && stage.conditions.length > 0 && (
              <ul style={{ paddingLeft: 20 }}>
                {stage.conditions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
            <textarea
              value={stageAnswers[stage.stage] || ""}
              onChange={(e) =>
                setStageAnswers((prev) => ({ ...prev, [stage.stage]: e.target.value }))
              }
              placeholder="여기에 답을 써 보세요."
            />
          </div>
        );
      })}
    </div>
  );
}
