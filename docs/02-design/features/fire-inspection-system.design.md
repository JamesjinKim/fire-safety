# Design: fire-inspection-system (소방안전점검 워크플로 시스템)

> PDCA Design 문서 · feature: `fire-inspection-system` · 작성 2026-05-23 · 갱신 2026-05-24 (MCP v2 보류)
> Plan: [../../01-plan/features/fire-inspection-system.plan.md](../../01-plan/features/fire-inspection-system.plan.md)
> 하위 데이터셋 Design: [fire-duty-master.design.md](./fire-duty-master.design.md) (그대로 유지)
> 법령 검증 출처: `reference/소방시설법 및 화재예방법령집.pdf`, 법제처 OpenAPI (law.go.kr)
> 양식 출처: `reference/별지 제9호서식.pdf` (2025-12-01 시행), `reference/별지 제4호서식.pdf` (71쪽 32종)
> **2026-05-24 변경**: MCP(`apps/mcp`)는 v2 후보로 보류. v1은 웹앱 일원화로 진행. 사유는 [../../01-overview.md §3.3](../../01-overview.md).

---

## 1. 설계 원칙 (확정)

1. **두 단계 분리**: 사무실(프로젝트 생성) / 현장(점검). 시스템·데이터·UI 모두 분리.
2. **계산은 코드, 해석은 LLM**: 법령 조회·시설 매칭·양식 조립은 결정론적 코드. LLM은 문장 정리·요약에만.
3. **작업지시 동결**: 단계 A 산출물(`WorkOrder`)은 immutable. 단계 B에서 다른 점은 별도 `Discrepancy` 로그로 기록.
4. **양식 정확성**: 별지 9호/4호 HTML은 A4 210×297mm 인쇄 1:1. CSS `@page size: A4`.
5. **v1은 로컬, v2는 bkend**: v1 데이터모델은 bkend 테이블 스키마와 1:1 대응되도록 미리 설계.

## 2. 사용자 확정 결정 (5개 설계 분기점)

| # | 분기점 | 결정 |
|---|---|---|
| 1 | monorepo 레이아웃 | **apps/web + packages/*** (pnpm workspaces). `apps/mcp`는 v2 보류 |
| 2 | 웹앱 렌더링 | **Next.js App Router + RSC** (인쇄 전용 `/print/...` 라우트 별도) |
| 3 | v1 저장소 | **로컬 JSON** (현 위치 `data/`) + **bkend 스키마 사전 설계** |
| 4 | 법령 시계열 전략 | **두 단계 분리**로 해소. 단계 A에서 동기 호출 → 결과를 `WorkOrder`에 동결 (작업지시가 곧 캐시) |
| 5 | 협업 락 입도 (v2) | **설비 단위** (예: `소화기구`, `옥내소화전`...) — v1에 자리만 확보 |
| 6 | MCP (2026-05-24 추가) | **v2 보류**. v1 도메인 로직은 웹앱 server function으로 구현. 실수요 검증 후 같은 함수를 얇은 MCP 래퍼로 노출 가능 |

## 3. 도메인 모델 (1등 시민)

```
┌──────────────────┐    1   N   ┌──────────────────┐
│  Project         │────────────│  WorkOrder        │ (단계 A 산출, immutable)
│  (단계 A 컨테이너) │            │  building snapshot│
│                  │            │  applicableLaw[]  │
│                  │            │  appliedFacilities│
│                  │            │  checklistOutline │
└────────┬─────────┘            └────────┬──────────┘
         │ 1                              │ 1
         │                                │
         │ N                              │ N
┌────────┴─────────┐            ┌────────┴──────────┐
│  Inspection      │───────────▶│  Discrepancy       │ (단계 B 변경 로그, append-only)
│  (단계 B 결과)    │   1   N    │  before/after/by   │
│  form9 + form4   │            │                    │
└──────────────────┘            └───────────────────┘
```

### 3.1 엔티티 핵심 필드

```typescript
// packages/types/src/domain.ts

interface Project {
  id: string;                    // ulid
  title: string;                 // "○○빌딩 2026 자체점검"
  building: BuildingMeta;        // 사용자 입력: 건축물대장
  createdBy: string;             // 관리자 사용자 ID
  createdAt: string;
  status: 'draft' | 'work-order-issued' | 'inspecting' | 'closed';
}

interface BuildingMeta {
  // 별지 9호서식 2쪽 건축물 정보를 1:1 매핑
  name: string;                  // 건물명(상호)
  category: string;              // 대상물 구분(용도)
  address: string;               // 소재지(도로명)
  buildingPermitDate: string;    // 건축허가일 ← 법령 매칭 키
  useApprovalDate: string;       // 사용승인일 ← 법령 매칭 키 (둘 중 후행)
  totalFloorArea: number;        // 연면적 ㎡
  buildingArea: number;          // 건축면적 ㎡
  householdCount?: number;       // 세대수 (공동주택)
  floorsAbove: number;           // 지상 층
  floorsBelow: number;           // 지하 층
  heightM: number;               // 높이 m
  buildingCount: number;         // 건물동수
  structure: '콘크리트' | '철골' | '조적' | '목구조' | '기타';
  roof: '슬래브' | '기와' | '슬레이트' | '기타';
  stairs: { 직통: number; 특별피난계단: number };
  elevators: { 승용: number; 비상용: number; 피난용: number };
  parking: { 옥내지하: number; 옥내지상: number; 필로티: number; 기계식: number; 옥상: number; 옥외: number };
  multiUseEstablishments: MultiUseEstablishment[];  // 다중이용업소
  fireSafetyGrade: '특급' | '1급' | '2급' | '3급';
}

interface WorkOrder {
  id: string;
  projectId: string;
  issuedAt: string;              // 동결 시점
  issuedBy: string;
  // 단계 A에서 결정된 immutable 스냅샷
  applicableLawSnapshot: LawCitation[];  // 법제처 API 응답 동결본
  appliedFacilities: FacilityScope[];    // 별지 9호 3쪽 32종 중 적용분
  checklistOutline: ChecklistRef[];      // 별지 4호 점검표 적용분 (PoC 5~7종)
  reasoning: string;             // 왜 이 시설이 적용되는지 (LLM 텍스트화)
  hash: string;                  // 내용 해시 (변조 감지)
}

interface FacilityScope {
  facilityCode: string;          // 예: "SC-소화기구"
  facilityName: string;          // 예: "소화기구 및 자동소화장치"
  category: '소화설비' | '경보설비' | '피난구조설비' | '소화용수설비' | '소화활동설비' | '기타' | '다중이용업소';
  legalBasis: LawCitation;       // 적용 근거 법조문
  required: boolean;             // 법령 강제 / 권고
  lockSectionId: string;         // v2 협업용 - v1은 채워두기만
}

interface LawCitation {
  lawName: string;               // "소방시설 설치 및 관리에 관한 법률"
  article: string;               // "제22조"
  paragraph?: string;            // "제3항"
  effectiveDate: string;         // 시행일 YYYY-MM-DD
  retrievedFrom: 'law.go.kr' | 'snapshot' | 'manual';
  retrievedAt: string;
  textExcerpt: string;           // 원문 발췌 (변조 방지)
}

interface Inspection {
  id: string;
  projectId: string;
  workOrderId: string;           // 어느 작업지시 기준인지
  type: 'operational' | 'comprehensive' | 'comprehensive-initial';
  inspectionPeriod: { start: string; end: string };
  inspectors: Inspector[];       // 주된/보조
  form9: Form9Data;              // 별지 9호 채움값
  form4: Form4Data;              // 별지 4호 채움값
  status: 'in-progress' | 'submitted' | 'archived';
  startedAt: string;
  submittedAt?: string;
}

interface Discrepancy {
  id: string;
  inspectionId: string;
  occurredAt: string;
  who: string;                   // 점검자 ID
  fieldPath: string;             // 예: "appliedFacilities[3].quantity"
  before: unknown;               // 작업지시의 원본 값
  after: unknown;                // 현장 수정 값
  reason: string;                // 점검자가 입력한 사유
  evidence?: { type: 'photo' | 'note'; ref: string }[];
}
```

### 3.2 별지 9호/4호 데이터 매핑

별지 9호서식의 모든 입력란이 `Form9Data`의 필드와 1:1. 필드명은 한국어 그대로 유지하지 않고
영문 카멜케이스로 변환하되, **렌더 시점에 라벨 매핑 테이블**로 한국어 양식 라벨에 일치시킨다.

별지 4호서식의 점검항목은 `Form4Data.items[]` 배열, 항목 식별자는 PDF 원문의 `1-A-001` 체계를
그대로 키로 사용한다. PoC 1차 점검표 (5~7종):

```typescript
const POC_CHECKLISTS = [
  { code: 1,  name: '소화기구 및 자동소화장치' },
  { code: 2,  name: '옥내소화전설비' },
  { code: 15, name: '자동화재탐지설비 및 시각경보장치' },
  { code: 20, name: '피난기구 및 인명구조기구' },
  { code: 21, name: '유도등 및 유도표지' },
  { code: 22, name: '비상조명등 및 휴대용비상조명등' },
  { code: 32, name: '다중이용업소' }  // 해당 시
];
```

## 4. 파일·디렉토리 구조 (확정)

```
fire-safety/                                  # repo root
├─ apps/
│  └─ web/                                    # Next.js App Router (Dynamic)
│     ├─ app/
│     │  ├─ page.tsx                           # 랜딩 / 프로젝트 리스트
│     │  ├─ project/
│     │  │  ├─ new/page.tsx                    # 단계 A: 건축물대장 입력
│     │  │  ├─ [id]/page.tsx                   # 프로젝트 상세
│     │  │  └─ [id]/work-order/page.tsx       # 작업지시 검토·동결
│     │  ├─ inspection/
│     │  │  ├─ [id]/page.tsx                   # 단계 B: 현장 점검 진행
│     │  │  └─ [id]/section/[sectionId]/page.tsx
│     │  ├─ print/
│     │  │  ├─ form9/[inspectionId]/page.tsx  # 별지 9호 인쇄 전용 (@page A4)
│     │  │  └─ form4/[inspectionId]/page.tsx  # 별지 4호 인쇄 전용
│     │  └─ api/                               # 내부 API (server actions 우선)
│     ├─ lib/
│     │  └─ domain/                            # v1 도메인 로직 (v2 MCP 래퍼 대상)
│     │     ├─ lookupLawByYear.ts
│     │     ├─ deriveInspectionScope.ts
│     │     ├─ composeWorkOrder.ts
│     │     └─ validateInspection.ts
│     ├─ components/
│     │  ├─ forms/Form9.tsx                    # 별지 9호 양식 (8쪽 분할)
│     │  └─ forms/Form4.tsx                    # 별지 4호 양식 (점검표 N종)
│     └─ next.config.mjs
│
├─ packages/
│  ├─ types/                                  # 공유 도메인 타입 (§3.1)
│  ├─ fire-data/                              # fire-duty-master.json + checklist 로더
│  └─ law-client/                             # 법제처 API 클라이언트 + 스냅샷
│
├─ data/                                      # 산출/원천 데이터
│  ├─ fire-duty-master.json                   # 기존 SSoT (유지)
│  ├─ inspection-checklist.json               # 별지 4호 점검항목 마스터 (신규, PoC 5~7종)
│  ├─ law-snapshots/                          # 법제처 API 응답 동결본
│  │  └─ {law-id}-{year}.json
│  └─ projects/                               # v1 로컬 저장소
│     └─ {projectId}/
│        ├─ project.json
│        ├─ work-order.json
│        ├─ inspection.json
│        └─ discrepancies.jsonl                # append-only
│
├─ reference/                                 # PDF 원본 (기존)
├─ docs/                                       # PDCA 문서 (기존, _archive/ 포함)
└─ pnpm-workspace.yaml
```

> **v2 MCP 부활 시**: `apps/web/lib/domain/*.ts` 4함수를 그대로 import하는 `apps/mcp/`를 추가하면 됨.
> v1 함수 시그니처를 MCP tool schema와 1:1 매핑되도록 설계하는 것이 사전 작업.

## 5. API · 인터페이스 (확정 후보)

### 5.1 도메인 함수 (apps/web/lib/domain/) — v1 핵심 로직

v1은 웹앱 내부 함수로 구현. v2 MCP 부활 시 그대로 MCP tool로 래핑하기 위해 **순수 함수 형태**로 유지 (입출력 명시, 부작용 분리).

| 함수 | Input | Output | 단계 | v2 MCP tool명 (예정) |
|---|---|---|---|---|
| `lookupLawByYear` | `{lawId, year}` | `LawCitation[]` (해당 시점 시행 본문) | A | `lookup_law_by_year` |
| `deriveInspectionScope` | `BuildingMeta` | `FacilityScope[]` + `reasoning` | A | `derive_inspection_scope` |
| `composeWorkOrder` | `Project` | `WorkOrder` (동결 직전 dryrun) | A | `compose_work_order` |
| `validateInspection` | `Inspection` | `Discrepancy[]` 후보 (사전 점검) | B | `validate_inspection` |

> 4함수 모두 **법제처 API 응답·정적 데이터·결정론적 룰**만 사용. LLM 호출 0. 환각 차단 원칙 유지.

### 5.2 웹앱 내부 API (app/api/...)

Server Action 우선, 복잡한 것만 route handler:

```
POST   /api/projects                       단계A 시작
POST   /api/projects/:id/work-order/issue  작업지시 동결 (immutable hash 생성)
POST   /api/inspections                    단계B 시작 (workOrderId 참조)
PATCH  /api/inspections/:id/section/:sid   섹션 단위 부분 저장 (v2 락 자리)
POST   /api/inspections/:id/discrepancies  변경 로그 append
GET    /api/inspections/:id/print/form9    인쇄용 정규화된 데이터
```

### 5.3 법제처 클라이언트 (packages/law-client)

```typescript
interface LawClient {
  // 단계 A에서만 호출. 단계 B는 호출 0.
  fetchLawAt(lawId: string, atDate: string): Promise<LawCitation[]>;
  // 스냅샷 캐시 우선, miss 시 API 호출 후 스냅샷에 저장
  // 환경변수 BUILD_TIME=true 면 API 강제 호출
}
```

응답 속도 우려는 단계 A 한 번만 부담하면 되므로 사용자 체감에 큰 영향 없음.
실패 시 동일 법령의 가장 가까운 시점 스냅샷으로 폴백 + UI에 명시.

## 6. HTML 양식 인쇄 1:1 (핵심 기술 결정)

### 6.1 CSS 표준
```css
@page {
  size: A4;          /* 210mm × 297mm */
  margin: 15mm 12mm; /* 별지 9호 여백 측정값 */
}
html { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.page { width: 186mm; height: 267mm; page-break-after: always; }
```

### 6.2 폰트
- 본문: 맑은 고딕 / 나눔고딕 (시스템 폴백). PDF 원본은 맑은 고딕 계열.
- 임베딩: `@font-face` `font-display: block` (인쇄 정확도 우선).

### 6.3 검증
- Chromium headless에서 인쇄 PDF 생성 → `pdf-lib`로 페이지 크기·좌표 자동 비교 (Phase 8 QA).
- 1차 합격 기준: 페이지 크기 210×297mm 일치, 표 셀 좌표 ±1mm 이내.

## 7. v2 협업 대비 데이터 자리 (지금 확보)

```typescript
interface FacilityScope {
  // ...
  lockSectionId: string;         // 설비 단위 락. v1은 채워두기만, 사용 안 함.
}

interface Form4Item {
  // ...
  lastEditedBy?: string;         // v2 충돌 감지용
  lastEditedAt?: string;
  lockHolder?: string;           // v2 락 점유자
}
```

→ v2에서 bkend 테이블로 옮길 때 컬럼 추가 없이 데이터 그대로 이전 가능.

## 8. 비기능 요구사항

| 항목 | v1 PoC 기준 |
|---|---|
| 응답 속도 (단계 A 작업지시 생성) | 30초 이내 (법제처 API 1~2회 호출 포함) |
| 응답 속도 (단계 B 점검 입력) | < 100ms (네트워크 의존 0) |
| 인쇄 정확도 | A4 210×297mm 1:1, 셀 좌표 ±1mm |
| 동시 사용자 (v1) | 1명 (단일 프로젝트당). v2부터 다중 |
| 변경 로그 보존 | append-only, 삭제 불가. JSONL로 v1 충분 |
| 점검 데이터 보존 | 2년 (법정) → 운영 단계 과제 |

## 9. 구현 순서 (Do 단계 가이드 후보)

1. **monorepo 부트스트랩**: pnpm workspaces, apps/web (Next.js init)
2. **packages/types**: §3.1 도메인 타입 코드화
3. **packages/fire-data**: 기존 `data/fire-duty-master.json` 로더 + `inspection-checklist.json` 신규 작성 (PoC 5~7종)
4. **packages/law-client**: 법제처 API 클라이언트 + 스냅샷 IO (먼저 mock으로 시작)
5. **apps/web/lib/domain/**: 4함수 구현 (`lookupLawByYear`, `deriveInspectionScope`, `composeWorkOrder`, `validateInspection`)
6. **apps/web 단계 A UI**: 건축물대장 입력 폼 (`BuildingMeta`) → 시설 도출 → 작업지시 검토·동결 화면
7. **별지 9호 HTML**: 8쪽 정적 레이아웃 + `Form9Data` 바인딩 + `/print` 라우트
8. **별지 4호 HTML**: 점검표 N종 (PoC 5~7) 정적 레이아웃 + 점검번호 키 바인딩
9. **apps/web 단계 B UI**: 점검 진행 화면 + Discrepancy 로그 작성 UI
10. **인쇄 검증**: Chromium headless로 PDF 생성 + 좌표 자동 비교

## 10. Open Questions (Design 단계 종료 시 해소 필요)

- [ ] 법제처 OpenAPI 키 발급 절차·할당량 (현재 미확인) → 단계 A 첫 구현 직전에 확인
- [ ] 별지 4호 32종 중 PoC 5~7종 최종 확정 (현재 후보 7개) → 사용자 추가 의견 받기
- [ ] 다중이용업소 분류(`MultiUseEstablishment`) 타입 enum 정의 → 별지 9호 2쪽 22개 업종 리스트로
- [ ] `BuildingMeta.fireSafetyGrade` 자동 판정 vs 사용자 입력 — 자동 판정은 별도 feature `assess-building-obligations`로 분리할지

## 11. 다음 단계

`/pdca do fire-inspection-system` — 구현 시작 (Phase 1: monorepo 부트스트랩)
