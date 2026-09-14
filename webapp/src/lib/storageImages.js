// stimulus_images / rubric_images 컬럼에는 파일명만 저장되어 있고(예: "img0051.jpg"),
// 실제 이미지 파일은 Supabase Storage의 "stimulus-images" 버킷(Public)에 올라가 있다.
// 버킷이 Public이므로 별도 인증 없이 아래 규칙의 URL로 바로 접근할 수 있다.

const BUCKET = "stimulus-images";

export function storageImageUrl(filename) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${BUCKET}/${filename}`;
}
