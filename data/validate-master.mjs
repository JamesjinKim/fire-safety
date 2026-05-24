#!/usr/bin/env node
// fire-duty-master.json 유효성 검증 (Design §6 검증 규칙)
// 실행: node data/validate-master.mjs
import { readFileSync } from "node:fs";

const path = new URL("./fire-duty-master.json", import.meta.url);
const master = JSON.parse(readFileSync(path, "utf8"));

const REQUIRED = ["docId", "title", "category", "legalRef", "formStrictness", "frequency", "applicableScope", "source"];
const catEnum = master._meta.categoryEnum;
const strictEnum = master._meta.formStrictnessEnum;
const legalRefRe = /^[가-힣A-Za-z]+:\d+/; // 법령약칭:조

let errors = [];
let todoCount = 0;
const ids = new Set();

for (const [i, d] of master.documents.entries()) {
  const at = `documents[${i}] ${d.docId ?? "(no docId)"}`;

  // 규칙1: 필수 필드 누락
  for (const f of REQUIRED) {
    if (d[f] === undefined || d[f] === "") errors.push(`${at}: 필수 필드 누락 '${f}'`);
  }
  // docId 중복
  if (ids.has(d.docId)) errors.push(`${at}: docId 중복`);
  ids.add(d.docId);

  // 규칙2: enum 범위
  if (d.category && !catEnum.includes(d.category)) errors.push(`${at}: category enum 위반 '${d.category}'`);
  if (d.formStrictness && !strictEnum.includes(d.formStrictness)) errors.push(`${at}: formStrictness enum 위반 '${d.formStrictness}'`);

  // 규칙3: legalRef 형식
  if (Array.isArray(d.legalRef)) {
    for (const ref of d.legalRef) {
      if (!legalRefRe.test(ref)) errors.push(`${at}: legalRef 형식 위반 '${ref}' (기대: 법령약칭:조)`);
    }
  } else if (d.legalRef !== undefined) {
    errors.push(`${at}: legalRef는 배열이어야 함`);
  }

  // 규칙4: TODO 카운트 (빈 추정값 금지 — TODO는 허용)
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === "string" && v.includes("TODO")) todoCount++;
  }
}

const total = master.documents.length;
const verified = master.documents.filter(d => !d.source.includes("TODO")).length;

console.log("─────────────────────────────────────");
console.log(`fire-duty-master.json 검증 (v${master._meta.version})`);
console.log("─────────────────────────────────────");
console.log(`문서 노드: ${total}개`);
console.log(`출처 검증완료(source에 TODO 없음): ${verified}개`);
console.log(`TODO 항목(추적 대상): ${todoCount}개`);
console.log(`오류: ${errors.length}개`);
if (errors.length) {
  console.log("\n[오류 목록]");
  errors.forEach(e => console.log("  ✗ " + e));
  process.exit(1);
}
// Design §6-5: 검증완료 노드 >= 3
if (verified < 3) {
  console.log(`\n✗ 검증완료 노드가 ${verified}개 — 성공기준(>=3) 미달`);
  process.exit(1);
}
console.log("\n✅ 스키마 유효 · 성공기준(검증완료 ≥ 3) 충족");
