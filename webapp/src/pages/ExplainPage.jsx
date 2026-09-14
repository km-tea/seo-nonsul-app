import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getItemShape } from "../lib/itemShape.js";
import TextBlock from "../components/TextBlock.jsx";
import ImageGrid from "../components/ImageGrid.jsx";

export default function ExplainPage() {
  const { itemId } = useParams();
  const { supabase } = useAuth();

  const [item, setItem] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");

      const [{ data: itemData, error: itemErr }, { data: subData, error: subErr }] =
        await Promise.all([
          supabase.from("items").select("*").eq("id", itemId).single(),
          supabase
            .from("submissions")
            .select("*")
            .eq("item_id", itemId)
            .order("attempt_no", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      if (cancelled) return;
      if (itemErr) {
        setError("문항을 불러오지 못했습니다: " + itemErr.message);
      } else if (subErr) {
        setError("채점 결과를 불러오지 못했습니다: " + subErr.message);
      } else {
        setItem(itemData);
        setSubmission(subData);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, itemId]);

  if (loading) return <p className="loading-line">불러오는 중...</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!item) return null;

  // 제출 기록이 없으면 채점 기준/정답이 노출되면 안 되므로 풀이 화면으로 안내한다.
  if (!submission) {
    return (
      <div className="empty-state">
        <p>아직 이 문항을 풀지 않았어요. 먼저 풀어야 해설을 볼 수 있어요.</p>
        <Link className="btn-secondary" to={`/items/${itemId}/solve`}>
          문제 풀러 가기
        </Link>
      </div>
    );
  }

  const shape = getItemShape(item);

  return (
    <div>
      <div className="solve-header">
        <div className="domain">{item.domain || item.grade_band}</div>
        <h1>{item.title}</h1>
      </div>

      <div className="score-banner">
        <span className="score-num">{submission.score ?? "-"}</span>
        <span>/ {submission.max_score ?? "?"}점</span>
      </div>

      <div className="explain-section">
        <h3>내가 쓴 답</h3>
        <div className="answer-block">
          <TextBlock text={submission.answer_text} />
        </div>
      </div>

      {submission.ai_feedback && (
        <div className="explain-section">
          <h3>선생님 코멘트</h3>
          <div className="feedback-block">
            <TextBlock text={submission.ai_feedback} />
          </div>
        </div>
      )}

      {shape === "raw_content" && <RawContentExplain item={item} />}
      {shape === "staged" && <StagedExplain item={item} />}
      {shape === "direct" && <DirectExplain item={item} />}
      {shape === "image_only" && <ImageOnlyExplain item={item} />}

      <div className="submit-row">
        <Link className="btn-secondary" to={`/items/${itemId}/solve`}>
          다시 풀어보기
        </Link>
        <Link className="btn-secondary" to="/">
          목록으로
        </Link>
      </div>
    </div>
  );
}

function RawContentExplain({ item }) {
  const rc = item.raw_content || {};
  const cleanRubricText = rc.채점기준표 || rc.채점기준;
  const hasRubricImage = item.rubric_images && item.rubric_images.length > 0;
  const [imageFailed, setImageFailed] = React.useState(false);
  const showImage = hasRubricImage && !imageFailed;

  return (
    <>
      {showImage ? (
        <div className="explain-section">
          <h3>채점 기준</h3>
          <ImageGrid
            filenames={item.rubric_images}
            label="채점 기준 이미지"
            onAllBroken={() => setImageFailed(true)}
          />
        </div>
      ) : (
        <Section title="채점 기준">{cleanRubricText}</Section>
      )}
      <Section title="예시 답안">{rc.예시답안}</Section>
      <Section title="채점할 때 참고할 점">{rc.채점유의점}</Section>
    </>
  );
}

function ImageOnlyExplain({ item }) {
  return (
    <div className="explain-section">
      <h3>채점 기준</h3>
      <ImageGrid filenames={item.rubric_images} label="채점 기준 이미지" />
      {(!item.rubric_images || item.rubric_images.length === 0) && (
        <p className="missing-content-note">
          이 문항은 별도 채점 기준 이미지가 없어요. 문제 이미지 속 조건을 참고해주세요.
        </p>
      )}
    </div>
  );
}

function DirectExplain({ item }) {
  const s56 = item.scoring_5_6 || {};
  const ex = item.example_answer || {};
  return (
    <>
      {s56.min_criteria && s56.min_criteria.length > 0 && (
        <Section title="채점 기준">
          {s56.min_criteria.map((c, i) => `· ${c.criterion}`).join("\n")}
        </Section>
      )}
      {ex.text && <Section title="예시 답안">{ex.text}</Section>}
    </>
  );
}

function StagedExplain({ item }) {
  const ex = item.example_answer || {};
  const stages = item.staged_questions || [];
  return (
    <>
      {stages.map((stage) => (
        <Section key={stage.stage} title={`${stage.label} 채점 기준`}>
          {stage.scoring_method ||
            (stage.rubric_elements || [])
              .map((r) => `· ${r.element}`)
              .join("\n")}
        </Section>
      ))}
      {ex.text && <Section title="예시 답안(마지막 단계 기준)">{ex.text}</Section>}
    </>
  );
}

function Section({ title, children }) {
  if (!children) return null;
  return (
    <div className="explain-section">
      <h3>{title}</h3>
      <div className="content">
        <TextBlock text={children} />
      </div>
    </div>
  );
}
