# Do: fire-inspection-system 구현 가이드

> PDCA Do 문서 · feature: `fire-inspection-system`
> 진입일 **2026-05-26** · Design v0.2.2 기준
> Design 원본: [../02-design/features/fire-inspection-system.design.md](../02-design/features/fire-inspection-system.design.md)
> 디자인 시안: [../design-preview/supabase-tone.html](../design-preview/supabase-tone.html)

---

## 0. Do 단계 진입 체크리스트

- [x] Plan v1 확정 (`docs/01-plan/features/fire-inspection-system.plan.md`)
- [x] PRD v0.1 작성 (`docs/01-plan/features/fire-inspection-system.prd.md`)
- [x] Design v0.2.2 확정 — PRD 통합 + OCR v1 + 디자인 토큰
- [x] design-validator CONDITIONAL PASS (블로커 3개 해소)
- [x] 디자인 시안 승인 (Pine Green `#2F9E44`)
- [x] Node 22 + pnpm 11 환경 확인
- [ ] Phase 1 시작

## 1. 구현 순서 16단계 (Design §9 기준)

각 Phase 완료 시 PR 또는 commit 권장. 굵게 표시된 항목은 **블로커 검증 갭(orgId, status 전이표 등) 병행 해소** 필요.

| # | Phase | 산출물 | 의존성 | 진행 |
|---|---|---|---|---|
| 1 | monorepo 부트스트랩 | `pnpm-workspace.yaml`, `apps/web/` (Next 16.2.6), `packages/{types,fire-data,law-client,ocr-client}/` 골격 | — | ✅ 2026-05-26 |
| 2 | 디자인 시스템 토큰 이식 | `apps/web/styles/{tokens,globals,print}.css` + Inter/JetBrains Mono + `/design-check` 검증 페이지 | 1 | ✅ 2026-05-26 |
| 3 | packages/types | §3.1 도메인 타입 전부 코드화 + `lib/auth/guard.ts`. **갭 #4 orgId 정책 결정** | 1 | 🔜 |
| 4 | packages/fire-data | `fire-duty-master.json` 로더 + `inspection-checklist.json` 신규 (PoC 7종) | 3 | ⏳ |
| 5 | packages/law-client | 법제처 API 클라이언트 + 스냅샷 IO. **먼저 mock으로 시작** | 3 | ⏳ |
| 6 | packages/ocr-client | `manual` provider만 (빈 extraction 반환). 실제 엔진은 Open Q 후 | 3 | ⏳ |
| 7 | lib/domain 6함수 | `extractBuildingRegister`, `lookupLawByYear`, `suggestFacilities`, `deriveInspectionScope`, `composeWorkOrder`, `validateInspection` | 3,4,5,6 | ⏳ |
| 8 | 단계 A-1 UI | 로그인 + CustomerCompany/Building/InspectionProject 생성 | 2,3,7 | ⏳ |
| 9 | 단계 A-2 UI (OCR 검수) | 건축물대장 업로드 + 검수 화면(원본 PDF vs 추출 필드) + confirm | 8 | ⏳ |
| 10 | 단계 A-3 UI (설비 추천 검수) | `suggestFacilities` 실행 + included/excluded/modified/pending | 9 | ⏳ |
| 11 | 단계 A-4 UI (작업지시 동결) | `composeWorkOrder` + hash + immutable 표시 | 10 | ⏳ |
| 12 | 별지 9호 HTML | 8쪽 정적 + Form9Data 바인딩 + `/print/form9` (§6 인쇄 표준, §6A 비적용) | 11 | ⏳ |
| 13 | 별지 4호 HTML | 점검표 7종 + 점검번호 키(`1-A-001`) | 11 | ⏳ |
| 14 | 단계 B UI (현장 점검) | 점검 홈 + 설비별 입력(InspectionResult + FieldNote) + Discrepancy | 11,13 | ⏳ |
| 15 | 비용 문서 | BillingDocument + `BillingInvoice.tsx` + `/print/billing` | 11 | ⏳ |
| 16 | 인쇄 검증 | Chromium headless PDF 생성 + 좌표 자동 비교 | 12,13,15 | ⏳ |

## 2. Phase 1: monorepo 부트스트랩 (실행 명령)

### 2.1 디렉토리 골격

```
fire-safety/
├─ apps/
│  └─ web/                  # Next.js 15 App Router (Phase 1에서는 init만)
├─ packages/
│  ├─ types/                # 공유 도메인 타입 (Phase 3에서 채움)
│  ├─ fire-data/            # 정적 데이터 로더 (Phase 4)
│  ├─ law-client/           # 법제처 API (Phase 5)
│  └─ ocr-client/           # OCR provider (Phase 6)
├─ data/                    # 기존 유지
├─ docs/                    # 기존 유지
├─ html/                    # 기존 유지 (Phase 12-13에서 컴포넌트로 이식)
├─ reference/               # 기존 유지
├─ pnpm-workspace.yaml      # 신규
├─ package.json             # 신규 (workspace root)
├─ tsconfig.base.json       # 신규 (공통 컴파일 옵션)
└─ .prettierrc              # 신규 (선택)
```

### 2.2 실행 명령 (수동, 사용자 승인 후 진행)

```bash
# 작업 디렉토리: fire-safety repo root

# 1) workspace root
pnpm init                                  # package.json (name: fire-safety-monorepo, private: true)
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - apps/*
  - packages/*
EOF

# 2) Next.js 앱 (TypeScript + App Router + ESLint, src 폴더 없이, alias @/*)
mkdir -p apps
pnpm create next-app@latest apps/web \
  --typescript --eslint --app --no-src-dir \
  --import-alias "@/*" --no-tailwind --no-turbopack

# 3) packages 골격 (각각 package.json + src/index.ts placeholder)
for pkg in types fire-data law-client ocr-client; do
  mkdir -p packages/$pkg/src
  cat > packages/$pkg/package.json <<EOF
{
  "name": "@fire-safety/$pkg",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts"
}
EOF
  echo "export {};" > packages/$pkg/src/index.ts
done

# 4) tsconfig.base.json + 각 패키지/앱 tsconfig extends
cat > tsconfig.base.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "lib": ["ES2022", "DOM"],
    "paths": {
      "@fire-safety/types": ["./packages/types/src"],
      "@fire-safety/fire-data": ["./packages/fire-data/src"],
      "@fire-safety/law-client": ["./packages/law-client/src"],
      "@fire-safety/ocr-client": ["./packages/ocr-client/src"]
    }
  }
}
EOF

# 5) apps/web가 workspace 패키지를 참조하도록 package.json 수정
#    pnpm add -F web @fire-safety/types@workspace:* ... (Phase 3에서 진행)

# 6) 검증
pnpm install
pnpm -F web dev    # http://localhost:3000 동작 확인
```

> **확인 사항**: Next.js `create next-app`은 대화형 프롬프트. 위 플래그로 비대화형 가능하나 버전에 따라 일부 옵션이 다를 수 있음 — 사용자 직접 실행 권장.

### 2.3 .gitignore 추가

기존 `.gitignore`에 다음 항목이 이미 있음 (확인 완료):
- `node_modules/`, `.next/`, `dist/`, `coverage/`, `.env*`

추가 권장 (없으면):
```
# pnpm
.pnpm-debug.log
.pnpm-store/
```

## 3. Phase 2: 디자인 시스템 토큰 이식

### 3.1 폰트 의존성

```bash
pnpm -F web add @fontsource/inter @fontsource/jetbrains-mono
```

### 3.2 파일 작성 순서

1. `apps/web/styles/tokens.css` — Design §6A.2 / 6A.4의 CSS 변수 그대로 박제
2. `apps/web/styles/globals.css` — `@import 'tokens.css'` + 리셋 + base 타이포 + 폰트 import
3. `apps/web/styles/print.css` — Design §6 인쇄 표준 (`@page A4`, `print-color-adjust`). **tokens.css 비포함**
4. `apps/web/app/layout.tsx`에서 `globals.css` import
5. `apps/web/app/print/layout.tsx` 신규 — `print.css`만 import, globals 비포함

### 3.3 시안 검증

`docs/design-preview/supabase-tone.html`을 옆에 열고 색상값·폰트·간격이 1:1 일치하는지 눈으로 확인.
간단한 데모 페이지(`apps/web/app/_design-check/page.tsx`)에 다음 요소 렌더:
- `display-lg` 헤딩 1개
- Primary 버튼 + Outline 버튼
- 카드 1개 + Pill 3종 (green/warn/fail)
- "확정" 뱃지

## 4. 병행 결정 사항 (Phase 3 진입 전 결론 필요)

design-validator가 식별한 갭 중 코드에 직접 영향:

### 4.1 갭 #4: orgId 정책
- **선택지 A** (권장): 모든 entity에 `orgId: string` 추가. 미래 호환 우수, v1 코드도 깔끔.
- **선택지 B**: `orgId`는 `Project`까지만, 하위 entity는 `projectId` 경유로 추론. v1 단순하나 v2 마이그레이션 시 추가 작업.

### 4.2 갭 #6: InspectionAssignment 명시화
- 결정 이미 됨 (Design `InspectionSection.assignedUserIds[]`로 대체)
- Phase 3에서 changelog/주석에 결정 사유만 명시하면 됨

### 4.3 갭 #7: InspectionProject.status 전이표
- Phase 3에서 `packages/types/src/transitions.ts`에 상태머신 코드화 권장
- 각 API 핸들러가 어떤 전이를 수행하는지 표 형태 주석

### 4.4 v1 권한 모델 (Open Q)
- Phase 3 `lib/auth/guard.ts` 작성 시 결정
- 임시 결정: admin은 자기 orgId의 모든 프로젝트 접근, field는 `InspectionAssignment` (= `assignedUserIds[]`)로 받은 섹션만 접근

## 5. Phase 1+2 종료 기준

- [ ] `pnpm install` 성공
- [ ] `pnpm -F web dev`로 Next.js 기본 화면 동작
- [ ] `apps/web/app/_design-check/page.tsx`가 시안과 1:1 일치 (Pine Green CTA, Inter 본문, JetBrains Mono 숫자)
- [ ] `apps/web/app/print/layout.tsx`가 globals.css를 로드하지 않음 (인쇄 톤 분리 확인)
- [ ] Git commit: `chore: phase 1+2 — monorepo bootstrap + design tokens`

## 6. 다음 단계

Phase 1+2 완료 후:
- `/pdca status` — Do phase 진행도 확인
- Phase 3 진입 (packages/types 작성) 시 갭 #4 (orgId) 결정 필요
- Phase 6 완료 시 OCR 엔진 PoC 트리거 (Open Q)

병행 권장:
- 데이터셋: `data/fire-duty-master.json` TODO 25개 해소 (별도 작업)
- OCR 엔진 비교 PoC (Google Vision / Upstage / Clova, 건축물대장 10건)
