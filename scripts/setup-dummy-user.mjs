// 더미 로그인 계정 셋업 스크립트 (사용자가 직접 실행)
// 실행: 프로젝트 루트에서  node scripts/setup-dummy-user.mjs
// - .dev.vars 에서 SUPABASE_URL / SUPABASE_SERVICE_KEY 를 읽어 admin API 호출
// - 기존 Auth 유저 전부 삭제 후, 아래 더미 계정 1개 생성
// ─────────────────────────────────────────────
// ▼▼ 실행 전 이 두 줄만 원하는 값으로 바꾸세요 ▼▼
const DUMMY_EMAIL = "cto@deepstudio.io";
const DUMMY_PASSWORD = "test1234";   // 데모용. 원하는 값으로 교체
// ▲▲ ───────────────────────────────────────── ▲▲

import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".dev.vars", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) throw new Error(".dev.vars 에 SUPABASE_URL / SUPABASE_SERVICE_KEY 가 필요합니다");

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// 1) 기존 유저 조회
const listRes = await fetch(`${URL}/auth/v1/admin/users`, { headers: h });
const listJson = await listRes.json();
const users = listJson.users || [];
console.log(`기존 Auth 유저 ${users.length}명:`, users.map((u) => u.email).join(", ") || "(없음)");

// 2) 기존 유저 전부 삭제
for (const u of users) {
  const del = await fetch(`${URL}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: h });
  console.log(`  삭제 ${u.email} → ${del.status === 200 ? "OK" : "실패(" + del.status + ")"}`);
}

// 3) 더미 계정 생성 (이메일 자동확인)
const create = await fetch(`${URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({ email: DUMMY_EMAIL, password: DUMMY_PASSWORD, email_confirm: true }),
});
const created = await create.json();
if (create.ok) {
  console.log(`\n✅ 더미 계정 생성 완료`);
  console.log(`   이메일:   ${DUMMY_EMAIL}`);
  console.log(`   비밀번호: ${DUMMY_PASSWORD}`);
  console.log(`   → localhost:5174/login 에서 위 계정으로 로그인하세요.`);
} else {
  console.log("❌ 생성 실패:", JSON.stringify(created));
}
