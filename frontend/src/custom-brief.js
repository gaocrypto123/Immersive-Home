const PLAN_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export function validateUpload(file, plan = false) {
  if (!(plan ? PLAN_TYPES : IMAGE_TYPES).includes(file.type))
    return plan
      ? "平面图支持 JPG、PNG、WebP 或 PDF。"
      : "风格参考支持 JPG、PNG 或 WebP 图片。";
  if (!Number.isFinite(file.size) || file.size <= 0)
    return "这个文件是空的，请重新选择。";
  if (file.size > (plan ? 20 : 10) * 1024 * 1024)
    return plan ? "平面图不能超过 20 MB。" : "每张风格参考图不能超过 10 MB。";
  return "";
}
export function briefReady(plan, references, form) {
  const people = Number(form.people),
    budget = Number(form.budget);
  return (
    plan.length === 1 &&
    references.length > 0 &&
    references.length <= 6 &&
    form.needs.trim().length >= 8 &&
    Number.isInteger(people) &&
    people >= 1 &&
    people <= 20 &&
    Number.isFinite(budget) &&
    budget >= 500 &&
    budget <= 1000000
  );
}
