// 학생이 제출한 답안을 문항의 채점 기준(raw_content / staged_questions / question+scoring_5_6 /
// stimulus_images만 있는 이미지 전용 문항)에 맞춰 Gemini로 채점하고,
// 결과를 submissions 테이블에 저장한다.
// service_role 키를 쓰므로 이 함수 안에서 반드시 JWT를 직접 검증해서 본인 확인을 해야 한다
// (RLS는 service_role에 대해 우회되므로 여기서 걸러주지 않으면 아무나 남의 이름으로 제출 가능해짐).

const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const STORAGE_BUCKET = "stimulus-images";

function verifyToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
  } catch {
    return null;
  }
}

function storageImageUrl(filename) {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${filename}`;
}

async function fetchImageAsInlinePart(filename) {
  const res = await fetch(storageImageUrl(filename));
  if (!res.ok) throw new Error(`이미지를 가져오지 못했습니다(${filename}): ${res.status}`);
  const mime = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { inline_data: { mime_type: mime, data: buf.toString("base64") } };
}

// raw_content / staged_questions / question 중 하나가 있는 "텍스트 기반" 문항용 프롬프트.
// image_only 문항은 별도로 처리한다(아래 buildImageOnlyParts).
function buildPrompt(item, payload) {
  if (item.raw_content) {
    const rc = item.raw_content;
    // raw_content는 두 가지 스키마가 섞여 있다(SolvePage.jsx 주석 참고): 필드가 없으면 대체 키를 쓴다.
    const 문항 = rc.평가문항 || rc.문항 || "";
    const 채점기준 = rc.채점기준표 || rc.채점기준 || "";
    return {
      maxScore: extractMaxScore(rc.문항정보) ?? 10,
      prompt: `
너는 한국 학교의 서·논술형 평가 채점을 돕는 채점 보조 교사다.
아래 [문항 정보], [채점 기준표], [채점 시 유의점], [예시 답안]을 근거로 학생 답안을 채점하라.

[문항]
${문항}

[문항 정보(배점)]
${rc.문항정보 || ""}

[채점 기준표]
${채점기준}

[채점 시 유의점]
${rc.채점유의점 || ""}

[예시 답안]
${rc.예시답안 || ""}

[학생 답안]
${payload.answer_text || "(작성하지 않음)"}

위 채점 기준표를 근거로 점수를 매기고, 학생이 이해할 수 있는 말로 무엇을 잘했고 무엇이 부족한지
구체적으로 설명하라. 학생 답안에 실제로 없는 내용을 있다고 하지 말 것.
반드시 아래 JSON 형식으로만 답하라. 다른 텍스트를 절대 덧붙이지 마라.
{"score": 숫자, "max_score": 숫자, "feedback": "문자열"}
`.trim(),
    };
  }

  if (item.staged_questions && item.staged_questions.length > 0) {
    const stages = item.staged_questions;
    const totalPoints = stages.reduce((sum, s) => sum + (s.points || 0), 0);
    const stageBlocks = stages
      .map((s) => {
        const a = (payload.stage_answers || {})[s.stage] || "(작성하지 않음)";
        return `
- 단계 ${s.stage}(${s.label}, 배점 ${s.points}점)
  발문: ${s.prompt}
  채점방법: ${s.scoring_method || JSON.stringify(s.rubric_elements || [])}
  학생 답: ${a}`;
      })
      .join("\n");
    return {
      maxScore: totalPoints || 10,
      prompt: `
너는 초등학생의 서·논술형 답안을 채점하는 다정한 채점 보조 교사다.
아래는 3단계로 구성된 문항이다. 각 단계의 채점 기준에 따라 점수를 매기고 합산하라.
${stageBlocks}

초등학생 수준에 맞게 쉽고 다정한 말로 전체 피드백을 작성하라(단계별로 잘한 점과 고칠 점을 짚어줄 것).
반드시 아래 JSON 형식으로만 답하라. 다른 텍스트를 절대 덧붙이지 마라.
{"score": 숫자, "max_score": ${totalPoints || 10}, "feedback": "문자열"}
`.trim(),
    };
  }

  if (item.question) {
    const q = item.question;
    const s56 = item.scoring_5_6 || {};
    const conditions = (q.conditions || []).map((c) => `- ${c}`).join("\n");
    const criteria = (s56.min_criteria || [])
      .map((c) => `- ${c.criterion} (미충족 시 -${c.deduction_if_unmet}점)`)
      .join("\n");
    return {
      maxScore: s56.base_score || 10,
      prompt: `
너는 초등학생의 서·논술형 답안을 채점하는 다정한 채점 보조 교사다.

[문항]
${q.prompt}

[조건]
${conditions}

[기본 배점]
${s56.base_score || 10}점, 아래 기준 미충족 시 표시된 만큼 감점
${criteria}

[예시 답안]
${(item.example_answer || {}).text || ""}

[학생 답안]
${payload.answer_text || "(작성하지 않음)"}

초등학생이 이해하기 쉬운 다정한 말로 피드백을 작성하라.
반드시 아래 JSON 형식으로만 답하라. 다른 텍스트를 절대 덧붙이지 마라.
{"score": 숫자, "max_score": ${s56.base_score || 10}, "feedback": "문자열"}
`.trim(),
    };
  }

  return null;
}

function extractMaxScore(info) {
  if (!info) return null;
  const m = String(info).match(/배점\s*([0-9]+)점|([0-9]+)점\)/);
  if (!m) return null;
  return Number(m[1] || m[2]);
}

// stimulus_images만 있고 텍스트 지문이 전혀 없는 문항(2026 중등 정기시험 자료 일부).
// 문제와 채점 기준 자체가 스캔 이미지 안에 들어있으므로, 이미지를 그대로 Gemini에 실어 보낸다.
async function buildImageOnlyParts(item, payload) {
  const stimulusParts = [];
  for (const f of item.stimulus_images || []) {
    stimulusParts.push(await fetchImageAsInlinePart(f));
  }
  const rubricParts = [];
  for (const f of item.rubric_images || []) {
    rubricParts.push(await fetchImageAsInlinePart(f));
  }

  const instruction = `
너는 한국 학교의 서·논술형 평가 채점을 돕는 채점 보조 교사다.
첫 번째로 첨부한 이미지는 문제(제시문과 발문)이고, 그 다음 첨부한 이미지가 있다면
그것은 채점 기준표(정답/예시 답안)이다. 채점 기준표 이미지가 없다면 문제 이미지 안의
조건과 배점만 근거로 채점하라.

[학생 답안]
${payload.answer_text || "(작성하지 않음)"}

이미지 속 채점 기준을 근거로 점수를 매기고, 학생이 이해할 수 있는 말로 무엇을 잘했고
무엇이 부족한지 구체적으로 설명하라. 학생 답안에 실제로 없는 내용을 있다고 하지 말 것.
반드시 아래 JSON 형식으로만 답하라. 다른 텍스트를 절대 덧붙이지 마라.
{"score": 숫자, "max_score": 숫자, "feedback": "문자열"}
`.trim();

  return {
    maxScore: 10,
    parts: [{ text: instruction }, ...stimulusParts, ...rubricParts],
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gemini 무료 API 키는 분당 요청 수 제한이 있어서, 학생들이 한꺼번에 몰아서
// 제출하면 429(과다 요청) 오류가 날 수 있다. 바로 실패시키지 않고 잠깐 기다렸다가
// 몇 번 더 시도해서, 학생이 다시 누를 필요 없이 자동으로 넘어가도록 한다.
async function callGemini(parts, attempt = 1) {
  const MAX_ATTEMPTS = 3;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    const isRateLimited = res.status === 429 || res.status === 503;
    if (isRateLimited && attempt < MAX_ATTEMPTS) {
      // 2초, 4초 순서로 대기 후 재시도(지수 백오프)
      await sleep(2000 * attempt);
      return callGemini(parts, attempt + 1);
    }
    const friendly = isRateLimited
      ? "지금 채점 요청이 많이 몰려서 잠시 기다려야 해요. 30초 정도 후에 다시 제출해 주세요."
      : `Gemini 호출 실패 (${res.status}): ${text}`;
    throw new Error(friendly);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 응답이 비어 있습니다.");
  return JSON.parse(text);
}

function flattenAnswer(payload) {
  if (payload.stage_answers) {
    return Object.entries(payload.stage_answers)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([stage, text]) => `[단계 ${stage}]\n${text}`)
      .join("\n\n");
  }
  return payload.answer_text || "";
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "허용되지 않은 요청입니다." }) };
  }

  const claims = verifyToken(event);
  if (!claims) {
    return { statusCode: 401, body: JSON.stringify({ error: "로그인이 필요합니다." }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "요청 형식이 올바르지 않습니다." }) };
  }

  if (!payload.item_id) {
    return { statusCode: 400, body: JSON.stringify({ error: "item_id가 필요합니다." }) };
  }

  const { data: item, error: itemErr } = await supabase
    .from("items")
    .select("*")
    .eq("id", payload.item_id)
    .maybeSingle();

  if (itemErr || !item) {
    return { statusCode: 404, body: JSON.stringify({ error: "문항을 찾을 수 없습니다." }) };
  }

  const built = buildPrompt(item, payload);
  let maxScore;
  let graded;
  try {
    if (built) {
      maxScore = built.maxScore;
      graded = await callGemini([{ text: built.prompt }]);
    } else if (item.stimulus_images && item.stimulus_images.length > 0) {
      const imgBuilt = await buildImageOnlyParts(item, payload);
      maxScore = imgBuilt.maxScore;
      graded = await callGemini(imgBuilt.parts);
    } else {
      return { statusCode: 422, body: JSON.stringify({ error: "채점할 수 없는 문항 형식입니다." }) };
    }
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: e.message }) };
  }

  const { count } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("student_id", claims.sub)
    .eq("item_id", payload.item_id);

  const attemptNo = (count || 0) + 1;

  const { data: inserted, error: insErr } = await supabase
    .from("submissions")
    .insert({
      student_id: claims.sub,
      item_id: payload.item_id,
      answer_text: flattenAnswer(payload),
      score: graded.score,
      max_score: graded.max_score ?? maxScore,
      ai_feedback: graded.feedback,
      ai_raw_response: graded,
      attempt_no: attemptNo,
      graded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insErr) {
    return { statusCode: 500, body: JSON.stringify({ error: "채점 결과 저장에 실패했습니다: " + insErr.message }) };
  }

  return { statusCode: 200, body: JSON.stringify(inserted) };
};
