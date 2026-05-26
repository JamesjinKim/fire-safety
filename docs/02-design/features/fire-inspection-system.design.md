# Design: fire-inspection-system (소방안전점검 워크플로 시스템)

> PDCA Design 문서 · feature: `fire-inspection-system`
> 작성 2026-05-23 · 갱신 2026-05-24 (MCP v2 보류) · 갱신 **2026-05-26 (v0.2 — PRD 통합 + OCR v1 편입)**
> Plan: [../../01-plan/features/fire-inspection-system.plan.md](../../01-plan/features/fire-inspection-system.plan.md)
> PRD: [../../01-plan/features/fire-inspection-system.prd.md](../../01-plan/features/fire-inspection-system.prd.md) (v0.1 → 본 문서 v0.2에 통합 완료)
> 하위 데이터셋 Design: [fire-duty-master.design.md](./fire-duty-master.design.md) (그대로 유지)
> 법령 검증 출처: `reference/소방시설법 및 화재예방법령집.pdf`, 법제처 OpenAPI (law.go.kr)
> 양식 출처: `reference/별지 제9호서식.pdf` (2025-12-01 시행), `reference/별지 제4호서식.pdf` (71쪽 32종)

## Changelog

| 버전 | 일자 | 주요 변경 | 사유 |
|------|------|-----------|------|
| v0.1 | 2026-05-23 | 최초 작성. 2단계 워크플로, 4 도메인 함수, A4 1:1 인쇄 표준 | Plan 확정 직후 설계 |
| v0.1.1 | 2026-05-24 | MCP(`apps/mcp`)를 v2 후보로 보류. 도메인 4함수는 `apps/web/lib/domain/`에 순수 함수로 유지 | 페르소나가 LLM 호출자→웹폼 사용자로 이동. [../../01-overview.md §3.3](../../01-overview.md) |
| **v0.2** | **2026-05-26** | **PRD v0.1 통합 + OCR v1 편입**. ① 사용자/권한 모델 신설(Organization·User) ② CustomerCompany·Building 분리 ③ BuildingRegister + OCR 검수 단계 신설 ④ SuggestedFacilitySection(추천)과 WorkOrder(동결) 분리 ⑤ InspectionSection/InspectionResult/FieldNote/BillingDocument 명시 ⑥ 도메인 함수에 `extractBuildingRegister`, `suggestFacilities` 추가 ⑦ `packages/ocr-client` + `app/api/ocr` 신설 ⑧ 구현 순서에 OCR·검수·추천 검수 단계 삽입 | PRD 도입 개념을 단일 설계서로 정합. 사용자 결정: OCR v1 포함 + Design in-place 갱신 |
| **v0.2.1** | **2026-05-26** | **design-validator 블로커 3개 해소**. ① `MultiUseEstablishment` placeholder 타입 정의 (§3.1) ② `BuildingRegisterExtraction.fields`를 mapped type `{ [K in keyof BuildingMeta]?: ExtractedField<NonNullable<BuildingMeta[K]>> }`으로 수정 — 옵셔널 필드 안전 + 필드별 정확한 제네릭 유지 (§3.1) ③ `Form9Data`/`Form4Data`/`Form4Item`을 "derive view-model" 정책으로 명시하고 placeholder 타입 정의 (§3.2 신설). §7 중복 정의 정리. | Phase 1 `packages/types` 작성 시 타입 모호성 차단. 갭(orgId, status 전이표 등)은 Phase 1 진행 중 병행 해소. |
| **v0.2.2** | **2026-05-26** | **디자인 시스템 톤 확정**. ① 베이스: Supabase 디자인 톤 (화이트 캔버스 + 단일 액센트 + 절제된 그레이 래더). 출처: voltagent/awesome-design-md/supabase. ② Primary green을 Supabase 원본 `#3ecf8e`에서 **Pine Green `#2F9E44`** 로 교체 (소방·안전 도메인의 정통 그린 톤 적용, ForestGreen 사용자 선호를 신호성 확보를 위해 명도 +6%p 조정). ③ §6A "디자인 시스템 토큰" 섹션 신설(color/typography/spacing/radius/components). ④ §4 디렉토리에 `apps/web/styles/tokens.css` + `apps/web/styles/globals.css` 추가, §9 구현 순서 step 7 "디자인 시스템 토큰 이식"을 부트스트랩 직후로 명시. ⑤ 시각 미리보기: [docs/design-preview/supabase-tone.html](../../design-preview/supabase-tone.html) (프로젝트 목록 / OCR 검수 / 별지 4호 점검 입력 3화면). | 개발 진입 전 톤앤매너 확정으로 Phase 6+ UI 작업 시 일관성 보장. 데이터 밀도 높은 화면(OCR 검수, 별지 4호 점검표)에 적합한 절제된 화이트+단일 그린 액센트 톤 채택. |

---

## 1. 설계 원칙 (확정)

1. **두 단계 분리**: 사무실(프로젝트 생성) / 현장(점검). 시스템·데이터·UI 모두 분리.
2. **계산은 코드, 해석은 LLM**: 법령 조회·시설 매칭·양식 조립은 결정론적 코드. v1은 LLM 호출 0.
3. **작업지시 동결**: 단계 A 산출물(`WorkOrder`)은 immutable. 단계 B에서 다른 점은 별도 `Discrepancy` 로그로 기록.
4. **양식 정확성**: 별지 9호/4호 HTML은 A4 210×297mm 인쇄 1:1. CSS `@page size: A4`.
5. **v1은 로컬, v2는 bkend**: v1 데이터모델은 bkend 테이블 스키마와 1:1 대응되도록 미리 설계.
6. **자동화는 초안, 법정 판단은 확정값** (v0.2 신설): OCR·자동 추천은 입력 부담을 줄이는 보조 수단이며, 설비 추천 룰 입력값으로는 **관리자가 확정한 값(`confirmedBuildingMeta`)만** 사용. OCR 검수 미완료 시 설비 추천 실행 금지.
7. **추천→검수→동결 3단 분리** (v0.2 신설): 시설 산출은 `SuggestedFacilitySection`(추천, 가변) → 관리자 검수(included/excluded/modified/pending) → `WorkOrder`(동결, immutable) 3단계로 분리. v0.1의 단일 `composeWorkOrder` 호출은 두 함수(`suggestFacilities`, `composeWorkOrder`)로 분해.
8. **2역할 단순 모델** (v0.2 신설): v1은 `admin`(관리자)과 `field`(현장 사용자) 2역할만. 다만 `User.role`은 enum으로 두어 v2에서 팀장·검토자·대표자 분리로 확장할 자리만 확보.
9. **현장 기록의 그릇은 v1에 둔다** (v0.2 신설): 텍스트 메모, 사진, 음성 파일, 첨부를 `FieldNote`로 설비별·점검항목별 저장. v1은 수집까지, AI 정리는 v1.5+.

## 2. 사용자 확정 결정 (설계 분기점)

| # | 분기점 | 결정 |
|---|---|---|
| 1 | monorepo 레이아웃 | **apps/web + packages/*** (pnpm workspaces). `apps/mcp`는 v2 보류 |
| 2 | 웹앱 렌더링 | **Next.js App Router + RSC** (인쇄 전용 `/print/...` 라우트 별도) |
| 3 | v1 저장소 | **로컬 JSON** (현 위치 `data/`) + **bkend 스키마 사전 설계** |
| 4 | 법령 시계열 전략 | **두 단계 분리**로 해소. 단계 A에서 동기 호출 → 결과를 `WorkOrder`에 동결 (작업지시가 곧 캐시) |
| 5 | 협업 락 입도 (v2) | **설비 단위** (예: `소화기구`, `옥내소화전`...) — v1에 자리만 확보 |
| 6 | MCP (2026-05-24) | **v2 보류**. v1 도메인 로직은 웹앱 server function으로 구현. 실수요 검증 후 같은 함수를 얇은 MCP 래퍼로 노출 가능 |
| 7 | **OCR 범위 (v0.2)** | **v1 포함**. 건축물대장 PDF/이미지 업로드 → OCR 초안 생성 → 관리자 검수(원본 vs 추출값) → 확정값만 설비 추천에 사용. OCR 엔진 선정은 Open Question(§10). |
| 8 | **권한 모델 (v0.2)** | **2역할만 v1 (admin / field)**. `User.role` enum으로 v2 확장 자리 확보(`field-lead`, `reviewer`, `representative`). 권한 분기는 `apps/web/lib/auth/`에 단일 가드 함수. |
| 9 | **고객사·건물 계층 (v0.2)** | **3계층 분리**: `CustomerCompany` (고객사/건물주) → `Building` (점검 대상 건물) → `InspectionProject` (1회 점검 단위). v0.1의 `Project`는 `InspectionProject`로 명칭 정리. |
| 10 | **추천·검수·동결 분리 (v0.2)** | `SuggestedFacilitySection`(추천, 가변) ⟶ 관리자 검수(reviewStatus) ⟶ `WorkOrder`(동결, immutable hash) 3단으로 분리. v0.1의 단일 `composeWorkOrder`를 2함수로 분해. |
| 11 | **첨부 저장 (v0.2)** | v1은 **로컬 파일시스템** (`data/projects/{projectId}/attachments/`). bkend Storage 마이그레이션 경로만 미리 설계. Open Question에서 운영 방안 결정. |
| 12 | **비용 문서 (v0.2)** | **세금계산서 형태 PDF 생성까지만** v1. 실제 국세청 전자발행은 v1.5+. UI·문서에 "내부 보관·고객 전달용"임을 명시. |

## 3. 도메인 모델 (1등 시민)

### 3.0 엔티티 관계도 (v0.2)

```
┌──────────────┐
│ Organization │ 1 ─── N ┌──────┐                 (소방안전 점검회사 = 우리 SaaS 고객)
└──────┬───────┘         │ User │ role: admin/field
       │ 1               └──────┘
       │
       │ N
┌──────┴─────────┐ 1 ── N ┌──────────┐ 1 ── N ┌────────────────────┐
│ CustomerCompany│────────│ Building │────────│ InspectionProject  │  (1회 점검 단위)
└────────────────┘        └─────┬────┘        └─────────┬──────────┘
                                │ 1                     │ 1
                                │                       │
                                │ N                     ▼
                          ┌─────┴──────────┐    ┌──────────────────────────┐
                          │BuildingRegister│ ◀──│ projectId 참조           │
                          │ 원본 PDF/이미지 │    │ + extraction(OCR 초안)  │
                          │ + confirmedMeta│    │ + confirmationStatus     │
                          └────────────────┘    └──────┬───────────────────┘
                                                       │ confirmed 만
                                                       ▼
                                            ┌──────────────────────────┐
                                            │ SuggestedFacilitySection │  (추천, 가변)
                                            │ reviewStatus: included/  │
                                            │ excluded/modified/pending│
                                            └──────────┬───────────────┘
                                                       │ included/modified 확정
                                                       ▼
                                            ┌──────────────────────────┐
                                            │ WorkOrder (동결)         │  immutable + hash
                                            │ applicableLawSnapshot[]  │
                                            │ appliedFacilities[]      │
                                            │ checklistOutline[]       │
                                            └──────────┬───────────────┘
                                                       │ 1
                                                       │ N
                                            ┌──────────┴───────────────┐
                                            │ Inspection (단계 B)      │
                                            │  ├ InspectionSection[]  │ (설비별)
                                            │  │  ├ InspectionResult[] (점검항목별)
                                            │  │  └ FieldNote[]        (메모·사진·음성·첨부)
                                            │  └ Discrepancy[]         (작업지시 ↔ 현장 차이)
                                            └──────────┬───────────────┘
                                                       │
                                                       ▼
                                            ┌──────────────────────────┐
                                            │ OfficialForm (form9/form4)│ 출력 데이터
                                            └──────────────────────────┘
                                            ┌──────────────────────────┐
                                            │ BillingDocument          │ 세금계산서 형태 PDF
                                            └──────────────────────────┘
```

### 3.1 엔티티 핵심 필드

```typescript
// packages/types/src/domain.ts

// ─── 사용자/조직 (v0.2 신설) ──────────────────────────────────────────

interface Organization {
  id: string;                           // ulid
  name: string;                         // 소방안전 점검회사명
  businessRegistrationNumber?: string;  // 사업자등록번호
  representativeName?: string;
  contactPhone?: string;
  contactEmail?: string;
  createdAt: string;
}

interface User {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: 'admin' | 'field';              // v1 enum. v2 확장: 'field-lead' | 'reviewer' | 'representative'
  certifications?: InspectorCertification[];  // 소방안전관리자 자격 등 (point-in-time snapshot)
  active: boolean;
  createdAt: string;
}

interface InspectorCertification {
  type: string;                         // 예: '소방안전관리자 1급'
  number: string;
  issuedAt: string;
  expiresAt?: string;
}

// ─── 고객사·건물 계층 (v0.2 분리) ────────────────────────────────────

interface CustomerCompany {
  id: string;
  orgId: string;
  name: string;                         // 고객사/건물주명
  businessRegistrationNumber?: string;
  representativeName?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

interface Building {
  id: string;
  orgId: string;
  customerCompanyId: string;
  name: string;                         // 건물명(상호)
  address: string;                      // 소재지(도로명)
  createdAt: string;
  // 건축물대장 확정값은 BuildingRegister.confirmedBuildingMeta에서 참조 (snapshot per project)
}

// ─── 프로젝트(1회 점검 단위) ──────────────────────────────────────────

interface InspectionProject {                // v0.1의 `Project`를 명칭 정리
  id: string;
  orgId: string;
  customerCompanyId: string;
  buildingId: string;
  title: string;                        // "○○빌딩 2026 자체점검"
  inspectionType: 'operational' | 'comprehensive' | 'comprehensive-initial';
  createdBy: string;                    // admin User.id
  createdAt: string;
  status:
    | 'draft'                           // 프로젝트 생성 직후
    | 'register-uploaded'               // 건축물대장 업로드 완료
    | 'register-confirmed'              // OCR 검수·필수 필드 확정
    | 'facilities-suggested'            // 설비 추천 실행됨
    | 'work-order-issued'               // 작업지시 동결됨
    | 'inspecting'                      // 현장 점검 진행 중
    | 'submitted'                       // 별지 9호/4호 제출 완료
    | 'closed';                         // 비용 문서까지 마감
}

// ─── 건축물대장 + OCR 검수 (v0.2 신설) ───────────────────────────────

interface BuildingRegister {
  id: string;
  projectId: string;                    // 1 project ↔ 1 register (point-in-time snapshot)
  sourceFileId: string;                 // 원본 PDF/이미지 (attachments/...)
  extraction: BuildingRegisterExtraction;  // OCR 초안 (제공자별 신뢰도 포함)
  confirmationStatus: 'pending' | 'partial' | 'confirmed';
  confirmedBy?: string;                 // admin User.id
  confirmedAt?: string;
  confirmedBuildingMeta?: BuildingMeta; // 확정 시점에 생성, 이후 설비 추천 룰의 유일한 입력
}

interface BuildingRegisterExtraction {
  provider: 'manual' | 'google-vision' | 'upstage' | 'clova' | 'other';  // §10 Open Question
  extractedAt: string;
  // v0.2.1: mapped type으로 변경 — 옵셔널 필드 허용 + 필드별 정확한 제네릭 타입 유지
  // 누락된 필드는 키 자체가 없거나 status='missing'으로 채울 수 있음 (둘 다 허용)
  fields: { [K in keyof BuildingMeta]?: ExtractedField<NonNullable<BuildingMeta[K]>> };
}

interface ExtractedField<T> {
  rawValue: T | null;
  confidence: number;                   // 0..1 (manual은 1)
  status: 'extracted' | 'confirmed' | 'edited' | 'missing' | 'low-confidence';
  bboxOnSource?: { page: number; x: number; y: number; w: number; h: number };  // 원본 ↔ 추출값 시각 비교용
  editedBy?: string;
  editedAt?: string;
}

interface BuildingMeta {
  // 별지 9호서식 2쪽 건축물 정보를 1:1 매핑
  name: string;                         // 건물명(상호)
  category: string;                     // 대상물 구분(용도)
  address: string;                      // 소재지(도로명)
  buildingPermitDate: string;           // 건축허가일 ← 법령 매칭 키
  useApprovalDate: string;              // 사용승인일 ← 법령 매칭 키 (둘 중 후행)
  totalFloorArea: number;               // 연면적 ㎡
  buildingArea: number;                 // 건축면적 ㎡
  householdCount?: number;              // 세대수 (공동주택)
  floorsAbove: number;                  // 지상 층
  floorsBelow: number;                  // 지하 층
  heightM: number;                      // 높이 m
  buildingCount: number;                // 건물동수
  structure: '콘크리트' | '철골' | '조적' | '목구조' | '기타';
  roof: '슬래브' | '기와' | '슬레이트' | '기타';
  stairs: { 직통: number; 특별피난계단: number };
  elevators: { 승용: number; 비상용: number; 피난용: number };
  parking: { 옥내지하: number; 옥내지상: number; 필로티: number; 기계식: number; 옥상: number; 옥외: number };
  multiUseEstablishments: MultiUseEstablishment[];  // 다중이용업소 (§10 Open Q: 22개 업종 enum)
  fireSafetyGrade: '특급' | '1급' | '2급' | '3급';
  // v0.2 추가 (PRD §7.1)
  hasAlterationHistory?: boolean;       // 증축/용도변경 이력 (TODO: 검증필요)
}

// v0.2.1 placeholder: 별지 9호 2쪽 다중이용업소 22개 업종 enum은 §10 Open Q에서 해소.
// Phase 1에서는 자유 문자열로 시작하고 enum 확정 시 string → union으로 좁힌다.
interface MultiUseEstablishment {
  businessType: string;                 // TODO: enum (예: '단란주점' | '유흥주점' | '노래연습장' | ...)
  floor: string;                        // 위치한 층 (예: '지하1층', '3층')
  area: number;                         // 영업장 면적 ㎡
  unitName?: string;                    // 상호
  notes?: string;
}

// ─── 설비 추천 (v0.2 신설) ────────────────────────────────────────────

interface SuggestedFacilitySection {
  id: string;
  projectId: string;
  facilityCode: string;                 // 예: "SC-소화기구"
  facilityName: string;                 // 예: "소화기구 및 자동소화장치"
  category: '소화설비' | '경보설비' | '피난구조설비' | '소화용수설비' | '소화활동설비' | '기타' | '다중이용업소';
  reason: string;                       // 왜 추천했는지 (결정론 룰 출력)
  legalBasis: LawCitation[];            // 적용 근거 법조문(들)
  confidence: 'high' | 'needs-review';  // 룰 신뢰도
  reviewStatus: 'included' | 'excluded' | 'modified' | 'pending';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;                  // 관리자 메모(특히 modified/excluded 사유)
}

// ─── 작업지시 (동결) ──────────────────────────────────────────────────

interface WorkOrder {
  id: string;
  projectId: string;
  issuedAt: string;                     // 동결 시점
  issuedBy: string;
  // 단계 A에서 결정된 immutable 스냅샷
  buildingMetaSnapshot: BuildingMeta;   // 동결 시점의 확정 BuildingMeta 복사본
  applicableLawSnapshot: LawCitation[]; // 법제처 API 응답 동결본
  appliedFacilities: FacilityScope[];   // SuggestedFacilitySection 중 included/modified만 확정
  checklistOutline: ChecklistRef[];     // 별지 4호 점검표 적용분 (PoC 5~7종)
  reasoning: string;                    // 종합 사유 (관리자가 작성/편집)
  hash: string;                         // 내용 해시 (변조 감지)
}

interface FacilityScope {
  facilityCode: string;
  facilityName: string;
  category: SuggestedFacilitySection['category'];
  legalBasis: LawCitation;
  required: boolean;                    // 법령 강제 / 권고
  lockSectionId: string;                // v2 협업용 - v1은 채워두기만
  sourceSuggestionId: string;           // SuggestedFacilitySection.id 역참조 (감사 추적)
}

interface LawCitation {
  lawName: string;                      // "소방시설 설치 및 관리에 관한 법률"
  article: string;                      // "제22조"
  paragraph?: string;                   // "제3항"
  effectiveDate: string;                // 시행일 YYYY-MM-DD
  retrievedFrom: 'law.go.kr' | 'snapshot' | 'manual';
  retrievedAt: string;
  textExcerpt: string;                  // 원문 발췌 (변조 방지)
}

interface ChecklistRef {
  code: number;                         // 1..32 (별지 4호 32종 대분류)
  name: string;
  formCode: string;                     // 별지 4호 점검표 식별자
}

// ─── 현장 점검 (단계 B) ───────────────────────────────────────────────

interface Inspection {
  id: string;
  projectId: string;
  workOrderId: string;                  // 어느 작업지시 기준인지
  type: 'operational' | 'comprehensive' | 'comprehensive-initial';
  inspectionPeriod: { start: string; end: string };
  inspectors: Inspector[];              // 주된/보조 (User.id 참조)
  sections: InspectionSection[];        // 설비별 (PRD §6.4 입력 단위)
  status: 'in-progress' | 'submitted' | 'archived';
  startedAt: string;
  submittedAt?: string;
}

interface InspectionSection {           // v0.2: 별지 4호 점검표(=설비)별 컨테이너
  id: string;
  inspectionId: string;
  facilityCode: string;                 // WorkOrder.appliedFacilities[].facilityCode 와 매칭
  facilityName: string;
  checklistFormCode: string;            // 별지 4호 점검표 코드 (예: "1", "2", "15", "20", "21", "22", "32")
  assignedUserIds: string[];            // 현장 사용자 배정 (v2 다중 협업 자리)
  status: 'not-started' | 'in-progress' | 'completed' | 'needs-review';
  results: InspectionResult[];
  notes: FieldNote[];
  lastEditedBy?: string;                // v2 충돌 감지용 (v1에 자리만 확보)
  lastEditedAt?: string;
  lockHolder?: string;                  // v2 락 점유자
}

interface InspectionResult {            // v0.2: 별지 4호 점검항목 1개당 결과
  id: string;
  sectionId: string;
  checklistItemCode: string;            // 예: "1-A-007" (별지 4호 원문 키 그대로)
  result: 'pass' | 'fail' | 'not-applicable' | 'not-checked';
  defectDescription?: string;           // 부적합 시
  actionRequired?: string;              // 조치 필요사항
  attachmentIds?: string[];             // FieldNote.attachmentIds 와 별도(직접 첨부)
  updatedBy: string;
  updatedAt: string;
}

interface FieldNote {                   // v0.2: 텍스트/사진/음성/파일 현장 기록 그릇
  id: string;
  projectId: string;
  inspectionId: string;
  sectionId: string;
  checklistItemCode?: string;           // 항목 단위까지 좁히고 싶을 때만
  type: 'text' | 'voice' | 'photo' | 'file';
  title?: string;
  memo?: string;
  attachmentIds: string[];              // attachments/{projectId}/... 의 파일 ID들
  createdBy: string;
  createdAt: string;
}

interface Discrepancy {                 // 작업지시 ↔ 현장 차이 (append-only)
  id: string;
  inspectionId: string;
  occurredAt: string;
  who: string;                          // 점검자 User.id
  fieldPath: string;                    // 예: "appliedFacilities[3].quantity"
  before: unknown;                      // 작업지시의 원본 값
  after: unknown;                       // 현장 수정 값
  reason: string;                       // 점검자가 입력한 사유 (필수)
  evidence?: { type: 'photo' | 'note'; ref: string }[];
}

interface Inspector {
  userId: string;
  role: 'lead' | 'assist';
  certificationSnapshot?: InspectorCertification;  // 점검 시점의 자격 동결
}

// ─── 비용 문서 (v0.2 신설, PRD §9.6) ─────────────────────────────────

interface BillingDocument {
  id: string;
  projectId: string;
  customerCompanyId: string;
  status: 'draft' | 'issued' | 'voided';
  billingType: 'tax-invoice-draft' | 'quotation' | 'receipt';  // v1은 'tax-invoice-draft' 위주
  supplier: BillingParty;               // 공급자 (= 우리 고객사 Organization)
  recipient: BillingParty;              // 공급받는자 (= CustomerCompany)
  lineItems: BillingLineItem[];
  subtotalAmount: number;               // 공급가액 합계
  taxAmount: number;                    // 부가세 합계
  totalAmount: number;                  // 합계 (subtotal + tax)
  memo?: string;
  pdfFileId?: string;                   // 생성된 PDF (attachments/...)
  createdBy: string;
  createdAt: string;
  issuedAt?: string;
  // v1.5+에서 국세청 e-세로 API 연동 필드 자리만:
  externalProvider?: 'baroservice' | 'douzone' | 'gabia' | 'esero';
  externalInvoiceId?: string;
}

interface BillingParty {
  name: string;
  businessRegistrationNumber: string;
  representativeName?: string;
  address?: string;
  businessType?: string;                // 업태
  businessItem?: string;                // 종목
  contactEmail?: string;
}

interface BillingLineItem {
  name: string;                         // 품목명 (예: "○○빌딩 2026 종합점검")
  spec?: string;                        // 규격
  quantity: number;
  unitPrice: number;
  supplyAmount: number;                 // 공급가액
  taxAmount: number;                    // 부가세
  note?: string;
}
```

### 3.2 별지 9호/4호 데이터 매핑

#### 3.2.1 정책: Form9Data / Form4Data는 derive view-model (v0.2.1 명시)

**별지 양식 데이터는 별도 저장 entity가 아니라 `Inspection` + `WorkOrder`에서 파생되는 view-model이다.**
저장은 `Inspection.sections[]`(현장 실측치) + `WorkOrder.*`(동결된 메타)에 일원화하고,
`/api/inspections/:id/print/form9|form4` 응답에서 `composeForm9(inspection, workOrder)` / `composeForm4(inspection, workOrder)`
순수 함수로 derive한다. 양식 HTML 컴포넌트(`components/forms/Form9.tsx`, `Form4.tsx`)는 이 view-model을 props로 받는다.

이렇게 하는 이유:
- 별지 양식이 개정되어도(2025-12-01 시행본처럼) 저장 스키마가 흔들리지 않음
- 같은 점검 데이터로 form9·form4·미래 다른 양식까지 derive 가능
- v2 협업에서 충돌 감지 단위가 `InspectionSection`(설비)으로 유지됨

#### 3.2.2 별지 9호 출력 데이터 매핑

별지 9호서식의 모든 입력란이 `Form9Data`의 필드와 1:1. 필드명은 한국어 그대로 유지하지 않고
영문 카멜케이스로 변환하되, **렌더 시점에 라벨 매핑 테이블**로 한국어 양식 라벨에 일치시킨다.

| 별지 9호 쪽 | 데이터 출처 |
|---|---|
| 1쪽 표지 | `Inspection`(inspectionPeriod, inspectors) + `WorkOrder`(첨부서류) |
| 2쪽 건축물 정보 | `WorkOrder.buildingMetaSnapshot` |
| 3쪽 설비 요약 | `WorkOrder.appliedFacilities[]` |
| 4~7쪽 세부 현황 | `Inspection.sections[].results[]` 의 derive 집계 (수계/가스계/경보/피난구조/소화용수/소화활동) |
| 8쪽 불량 세부사항 | `Inspection.sections[].results[]` 중 `result === 'fail'` 집계 |

#### 3.2.3 별지 4호 출력 데이터 매핑

별지 4호서식의 점검항목은 PoC 1차 7종에 대해 `Form4Data.sections[].items[]` 배열로 직렬화하며,
**항목 식별자는 PDF 원문의 `1-A-001` 체계를 그대로 키로 사용**한다 (`InspectionResult.checklistItemCode`와 동일).

`Form4Data.sections[]` ↔ `Inspection.sections[]` (= `InspectionSection[]`) 1:1.
각 `Form4Data.sections[].items[]` ↔ `InspectionResult` 1:1.

#### 3.2.4 View-model 타입 placeholder (v0.2.1)

Phase 1에서 `packages/types/src/forms.ts`에 다음 derive 타입을 둔다. 별지 PDF 정밀 매핑은 Phase 11/12에서 채운다.

```typescript
// derive 함수: apps/web/lib/forms/composeForm9.ts, composeForm4.ts
// 저장하지 않고 API 응답 시점에 만들어진다.

interface Form9Data {
  cover: {                              // 1쪽 표지
    facilityName: string;
    address: string;
    inspectionPeriod: { start: string; end: string };
    inspectors: Inspector[];
    attachments: string[];              // 첨부서류 명칭 (PDF 사양)
  };
  building: BuildingMeta;               // 2쪽 (= WorkOrder.buildingMetaSnapshot)
  facilitySummary: {                    // 3쪽
    appliedFacilities: FacilityScope[];
    multiUseEstablishments: MultiUseEstablishment[];
  };
  detailedStatus: Form9DetailedStatus;  // 4~7쪽 (수계/가스계/경보/피난/소화용수/소화활동) — Phase 11에서 PDF 사양에 맞춰 확정
  defects: Form9Defect[];               // 8쪽 (result==='fail' 집계)
}

type Form9DetailedStatus = Record<
  '수계' | '가스계' | '경보' | '피난구조' | '소화용수' | '소화활동',
  Form9FacilityDetail[]
>;

interface Form9FacilityDetail {
  facilityCode: string;
  facilityName: string;
  fields: Record<string, string | number | null>;  // PDF 양식 셀별 값. Phase 11에서 cell 키 확정.
}

interface Form9Defect {
  facilityName: string;
  checklistItemCode: string;            // 예: "1-A-007"
  defectDescription: string;
  actionRequired?: string;
  inspectedAt: string;
}

interface Form4Data {
  workOrderRef: { id: string; issuedAt: string; hash: string };
  inspectionRef: { id: string; type: Inspection['type'] };
  sections: Form4Section[];             // POC_CHECKLISTS 7종 중 적용분
}

interface Form4Section {
  checklistFormCode: string;            // 예: "1", "2", "15"
  facilityName: string;
  inspectionType: 'comprehensive' | 'operational';  // 종합●/작동○ 표시 분기
  items: Form4Item[];                   // 별지 4호 점검항목
}

interface Form4Item {
  checklistItemCode: string;            // PDF 원문 키 그대로 (예: "1-A-007")
  description: string;                  // 점검항목 설명
  result: InspectionResult['result'];
  defectDescription?: string;
  actionRequired?: string;
  // v2 협업 충돌 감지 (v1은 채워두기만)
  lastEditedBy?: string;
  lastEditedAt?: string;
  lockHolder?: string;
}
```

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

## 4. 파일·디렉토리 구조 (v0.2 확정)

```
fire-safety/                                       # repo root
├─ apps/
│  └─ web/                                         # Next.js App Router (Dynamic)
│     ├─ app/
│     │  ├─ (auth)/login/page.tsx                  # v0.2: 로그인 (admin/field 공용)
│     │  ├─ page.tsx                                # 랜딩 / 프로젝트 리스트
│     │  ├─ customers/                              # v0.2: CustomerCompany / Building 관리
│     │  │  ├─ page.tsx
│     │  │  └─ [id]/page.tsx
│     │  ├─ project/
│     │  │  ├─ new/page.tsx                        # 단계 A-1: 프로젝트 생성 (고객사·건물 선택)
│     │  │  ├─ [id]/page.tsx                       # 프로젝트 상세
│     │  │  ├─ [id]/register/page.tsx              # v0.2: 단계 A-2: 건축물대장 업로드 + OCR 검수
│     │  │  ├─ [id]/facilities/page.tsx            # v0.2: 단계 A-3: 설비 추천 검토
│     │  │  ├─ [id]/work-order/page.tsx           # 단계 A-4: 작업지시 검토·동결
│     │  │  └─ [id]/billing/page.tsx               # v0.2: 비용 입력 + 세금계산서 PDF
│     │  ├─ inspection/
│     │  │  ├─ [id]/page.tsx                       # 단계 B: 현장 점검 홈 (배정 섹션 목록)
│     │  │  └─ [id]/section/[sectionId]/page.tsx   # 설비별 점검 입력 (InspectionResult + FieldNote)
│     │  ├─ print/
│     │  │  ├─ form9/[inspectionId]/page.tsx       # 별지 9호 인쇄 전용 (@page A4)
│     │  │  ├─ form4/[inspectionId]/page.tsx       # 별지 4호 인쇄 전용
│     │  │  └─ billing/[billingId]/page.tsx        # v0.2: 세금계산서 형태 PDF 인쇄 전용
│     │  └─ api/                                    # 내부 API (server actions 우선)
│     │     ├─ ocr/extract/route.ts                # v0.2: BuildingRegister OCR 호출
│     │     ├─ attachments/upload/route.ts         # v0.2: 사진·음성·파일 업로드
│     │     └─ ... (server actions 위주, 복잡한 것만 route handler)
│     ├─ styles/                                   # v0.2.2 신설
│     │  ├─ tokens.css                              # §6A 토큰 (color/typo/spacing/radius) — 모든 화면 공통
│     │  ├─ globals.css                             # 리셋 + tokens.css import + base 타이포
│     │  └─ print.css                               # §6 A4 인쇄 표준 (별지 9호/4호/세금계산서). tokens.css 비포함
│     ├─ lib/
│     │  ├─ auth/                                  # v0.2: role 가드 (admin/field) 단일 함수
│     │  │  └─ guard.ts
│     │  ├─ domain/                                # v1 도메인 로직 (v2 MCP 래퍼 대상)
│     │  │  ├─ extractBuildingRegister.ts          # v0.2 신설
│     │  │  ├─ lookupLawByYear.ts
│     │  │  ├─ suggestFacilities.ts                # v0.2 신설 (composeWorkOrder 전 단계)
│     │  │  ├─ deriveInspectionScope.ts            # (PoC 점검표 매핑, suggestFacilities 내부 호출)
│     │  │  ├─ composeWorkOrder.ts                 # v0.2: 검수된 SuggestedFacilitySection을 동결
│     │  │  └─ validateInspection.ts
│     │  └─ storage/                                # v0.2: 로컬 파일 저장 (v2 bkend Storage 교체 자리)
│     │     └─ localFileStore.ts
│     ├─ components/
│     │  ├─ forms/Form9.tsx                        # 별지 9호 양식 (8쪽 분할)
│     │  ├─ forms/Form4.tsx                        # 별지 4호 양식 (점검표 N종)
│     │  ├─ forms/BillingInvoice.tsx               # v0.2: 세금계산서 형태 양식
│     │  └─ register/                              # v0.2: OCR 검수 UI (원본 PDF ↔ 추출값 나란히)
│     │     ├─ RegisterReviewer.tsx
│     │     └─ FieldDiffBadge.tsx                  # extracted/confirmed/edited/low-confidence 뱃지
│     └─ next.config.mjs
│
├─ packages/
│  ├─ types/                                       # 공유 도메인 타입 (§3.1)
│  ├─ fire-data/                                   # fire-duty-master.json + checklist 로더
│  ├─ law-client/                                  # 법제처 API 클라이언트 + 스냅샷
│  └─ ocr-client/                                  # v0.2 신설: OCR provider 추상화 (manual/google-vision/upstage/clova)
│     ├─ src/index.ts                              # OCRProvider 인터페이스
│     ├─ src/providers/manual.ts                   # OCR 없이 사람이 직접 입력 (기본)
│     └─ src/providers/...                          # 실제 엔진은 §10 Open Question 후 추가
│
├─ data/                                           # 산출/원천 데이터
│  ├─ fire-duty-master.json                        # 기존 SSoT (유지)
│  ├─ inspection-checklist.json                    # 별지 4호 점검항목 마스터 (신규, PoC 5~7종)
│  ├─ law-snapshots/                               # 법제처 API 응답 동결본
│  │  └─ {law-id}-{year}.json
│  └─ projects/                                    # v1 로컬 저장소
│     └─ {projectId}/
│        ├─ project.json                           # InspectionProject
│        ├─ register.json                          # v0.2: BuildingRegister (extraction + confirmedBuildingMeta)
│        ├─ suggestions.json                       # v0.2: SuggestedFacilitySection[]
│        ├─ work-order.json                        # WorkOrder (동결)
│        ├─ inspection.json                        # Inspection + sections[]
│        ├─ discrepancies.jsonl                    # append-only
│        ├─ billing.json                           # v0.2: BillingDocument
│        └─ attachments/                           # v0.2: 원본 PDF/이미지/사진/음성/생성 PDF
│           ├─ source/{fileId}.{pdf|jpg|png}      # 원본 건축물대장
│           ├─ field/{fileId}.{jpg|m4a|...}       # 현장 사진/음성/메모 첨부
│           └─ output/{form9|form4|billing}-*.pdf  # 인쇄 PDF 결과
│
├─ reference/                                      # PDF 원본 (기존)
├─ docs/                                           # PDCA 문서 (기존, _archive/ 포함)
└─ pnpm-workspace.yaml
```

> **v2 MCP 부활 시**: `apps/web/lib/domain/*.ts` 함수들을 그대로 import하는 `apps/mcp/`를 추가하면 됨.
> v1 함수 시그니처를 MCP tool schema와 1:1 매핑되도록 설계하는 것이 사전 작업.

> **v2 bkend 마이그레이션 시**: `data/projects/{projectId}/*.json` ↔ bkend 테이블 1:1 매핑.
> `attachments/` ↔ bkend Storage(4 가시성 레벨 중 private/shared). `lib/storage/localFileStore.ts`만 교체.

## 5. API · 인터페이스 (v0.2 확정)

### 5.1 도메인 함수 (apps/web/lib/domain/) — v1 핵심 로직

v1은 웹앱 내부 함수로 구현. v2 MCP 부활 시 그대로 MCP tool로 래핑하기 위해 **순수 함수 형태**로 유지 (입출력 명시, 부작용 분리). v0.2에서 추천·동결을 분리하면서 함수가 4→6개로 늘었다.

| 함수 | Input | Output | 단계 | v2 MCP tool명 (예정) |
|---|---|---|---|---|
| **`extractBuildingRegister`** (v0.2 신설) | `{file: Buffer, mimeType, provider?: 'manual'\|'google-vision'\|...}` | `BuildingRegisterExtraction` (OCR 초안 + 필드별 신뢰도·bbox) | A | `extract_building_register` |
| `lookupLawByYear` | `{lawId, year}` | `LawCitation[]` (해당 시점 시행 본문) | A | `lookup_law_by_year` |
| **`suggestFacilities`** (v0.2 신설) | `{buildingMeta: BuildingMeta, asOfDate: string}` | `SuggestedFacilitySection[]` (reviewStatus = 'pending') + `reasoning` | A | `suggest_facilities` |
| `deriveInspectionScope` | `{appliedFacilities: FacilityScope[]}` | `ChecklistRef[]` (PoC 7종 중 적용분 매핑) | A | `derive_inspection_scope` |
| **`composeWorkOrder`** (v0.2 책임 재정의) | `{project, register, reviewedSuggestions: SuggestedFacilitySection[]}` (included/modified만) | `WorkOrder` (동결 직전 dryrun, hash 포함) | A | `compose_work_order` |
| `validateInspection` | `Inspection` | `Discrepancy[]` 후보 (사전 점검) | B | `validate_inspection` |

> **v0.2 변경**: 기존 단일 `composeWorkOrder(Project)`가 `suggestFacilities` → 관리자 검수 → `composeWorkOrder(reviewedSuggestions)` 2단으로 분리. PRD §4.2(추천 + 검수 + 동결 3단 분리) 반영.
>
> **공통 원칙**: 모든 함수는 **법제처 API 응답·정적 데이터·결정론적 룰**만 사용. LLM 호출 0. 환각 차단 원칙 유지.
> 예외: `extractBuildingRegister`의 OCR provider 호출은 외부 API이지만, **결과는 항상 관리자 검수(`confirmationStatus='confirmed'`)를 거쳐야 설비 추천에 사용**되므로 환각 위험 차단.

### 5.2 웹앱 내부 API (app/api/...)

Server Action 우선, 복잡한 것·외부 호출만 route handler:

```
─── 단계 A: 사무실 (admin role) ────────────────────────────────────────
POST   /api/customers                          CustomerCompany 생성
POST   /api/buildings                          Building 생성
POST   /api/projects                           InspectionProject 생성
POST   /api/projects/:id/register/upload       건축물대장 PDF/이미지 업로드 + BuildingRegister 초기화
POST   /api/ocr/extract                         OCR 호출 → BuildingRegisterExtraction (v0.2 신설)
PATCH  /api/projects/:id/register/fields       OCR 검수 필드 단위 수정 (status: extracted→edited/confirmed)
POST   /api/projects/:id/register/confirm      검수 완료 → confirmedBuildingMeta 저장 (이후 설비 추천 활성화)
POST   /api/projects/:id/suggestions/run       suggestFacilities 실행 (v0.2 신설)
PATCH  /api/projects/:id/suggestions/:sid      추천 검수 (included/excluded/modified/pending)
POST   /api/projects/:id/work-order/issue      composeWorkOrder + 동결 (hash 생성, immutable)
POST   /api/projects/:id/billing               BillingDocument 작성 (v0.2 신설)
GET    /api/projects/:id/billing/:bid/pdf      세금계산서 형태 PDF 생성

─── 단계 B: 현장 (field role) ──────────────────────────────────────────
POST   /api/inspections                        Inspection 시작 (workOrderId 참조)
PATCH  /api/inspections/:id/sections/:sid     섹션 단위 부분 저장 (v2 락 자리)
PUT    /api/inspections/:id/sections/:sid/results/:rid  InspectionResult 입력
POST   /api/inspections/:id/sections/:sid/notes  FieldNote 작성 (v0.2 신설)
POST   /api/attachments/upload                  FieldNote 첨부 파일 업로드 (v0.2 신설)
POST   /api/inspections/:id/discrepancies      변경 로그 append (작업지시 ↔ 현장 차이)
GET    /api/inspections/:id/print/form9        인쇄용 정규화된 form9 데이터
GET    /api/inspections/:id/print/form4        인쇄용 정규화된 form4 데이터
```

권한 가드는 `apps/web/lib/auth/guard.ts`의 `requireRole('admin' | 'field')` 단일 함수로 통일.

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

### 5.4 OCR 클라이언트 (packages/ocr-client) — v0.2 신설

```typescript
interface OCRProvider {
  name: 'manual' | 'google-vision' | 'upstage' | 'clova' | 'other';
  // 건축물대장 1건을 BuildingRegisterExtraction으로 변환.
  // provider='manual'은 빈 extraction을 반환하고 사용자가 수동 입력.
  extractBuildingRegister(input: {
    file: Buffer;
    mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  }): Promise<BuildingRegisterExtraction>;
}

// v1 기본: manual provider (OCR 엔진 선정 전까지). 엔진 선정은 §10 Open Question.
// 엔진 추가 시 환경변수 OCR_PROVIDER 로 스위치, 코드 변경 없이 교체 가능.
```

원본 PDF/이미지는 `data/projects/{projectId}/attachments/source/`에 보관, bbox 좌표는 원본 좌표계 기준.

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

## 6A. 디자인 시스템 토큰 (v0.2.2 신설)

### 6A.1 베이스 톤 결정

- **베이스**: Supabase 디자인 톤 (화이트 캔버스 + 단일 그린 액센트 + 절제된 그레이 래더)
  - 출처: [VoltAgent/awesome-design-md · supabase](https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/supabase)
  - 채택 사유: ① 데이터 밀도 높은 화면(별지 4호 점검표 32종, OCR 검수)에 적합 ② "가볍게" 포지셔닝과 정합 ③ 영세 점검업체 비IT 사용자 친숙도 ④ A4 인쇄 양식과 톤 충돌 없음
- **Primary green 교체**: Supabase 원본의 청록빛 `#3ecf8e` → 정통 그린 계열 **`#2F9E44` (Pine Green)** 로 교체
  - 사용자 선호(ForestGreen `#228B22`) 방향을 유지하되, 명도 34→40%로 조정해 어두운 면 옆에서도 "신호"로 작동
  - 소방·안전 도메인의 친숙한 그린
- **시각 미리보기**: [docs/design-preview/supabase-tone.html](../../design-preview/supabase-tone.html)
  - 3개 핵심 화면(프로젝트 목록 / OCR 검수 / 별지 4호 점검 입력)을 실제 토큰으로 구현한 단일 페이지 시안.

### 6A.2 컬러 토큰 (확정)

```css
:root {
  /* Primary — 단일 액센트 (Pine Green) */
  --primary:       #2F9E44;
  --primary-deep:  #237A35;   /* hover/pressed */
  --primary-soft:  #e6f3e7;   /* 확정 뱃지/연한 배경 */

  /* Ink (텍스트) */
  --ink:           #171717;   /* primary text. 절대 순수 #000 사용 안 함 */
  --ink-2:         #212121;
  --ink-mute:      #707070;   /* 보조 텍스트, 메타 */
  --ink-mute-2:    #9a9a9a;
  --ink-faint:     #b2b2b2;   /* placeholder */

  /* Canvas (배경) */
  --canvas:        #ffffff;
  --canvas-soft:   #fafafa;   /* 페이지 배경, 카드 호버 */
  --canvas-night:  #1c1c1c;   /* 인쇄 미리보기 사이드바, 코드 블록 */

  /* Hairline (구분선·테두리) */
  --hairline:        #dfdfdf;
  --hairline-strong: #c7c7c7;
  --hairline-cool:   #ededed;
  --hairline-cool-2: #efefef;

  /* Semantic (Supabase 시스템에 우리가 추가) */
  --pass:           #2F9E44;  /* = primary, "적합" */
  --fail:           #e02d3c;  /* "부적합", 불량 카운트 */
  --fail-soft:      #fde8ea;
  --na:             #9a9a9a;  /* "해당없음" */
  --not-checked:    #f5a623;  /* "미점검" */
  --confirm:        var(--primary);  /* OCR 확정 */
  --extracted:      #707070;         /* OCR 추출됨 */
  --edited:         #3340a9;         /* OCR 사용자 수정 */
  --low-confidence: #92560c;         /* OCR 신뢰도 낮음 */
  --missing:        #e02d3c;         /* OCR 누락 */
}
```

> **원칙**: 그린 `--primary` 외에는 컬러를 거의 사용하지 않는다. 차트·차별 표시 등에서 부득이한 경우만 semantic 토큰을 추가 사용.

### 6A.3 타이포 토큰

- **본문 폰트**: Inter (Supabase 원본 Circular 대체 — Circular는 상용 라이선스라 OSS Inter로). Google Fonts 또는 NPM `@fontsource/inter`.
- **숫자/코드 폰트**: JetBrains Mono — 점검번호(`1-A-007`), 작업지시 해시(`a4f3·8b2`), 측정값(`0.21 MPa`)에 사용. 별지 4호 점검번호 체계 유지에 필수.
- **한글 본문**: Inter는 한글 글리프가 없으므로 시스템 폴백 `'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR'` 체인. v1은 시스템 폴백, 인쇄 검증 단계에서 Pretendard `@font-face` 임베딩 검토.

| 스케일 | size / weight / line / tracking | 용도 |
|---|---|---|
| `display-lg` | 36 / 500 / 1.15 / -0.72px | 페이지 타이틀 (프로젝트, 점검 진행) |
| `display-md` | 28 / 500 / 1.20 / -0.42px | 섹션 헤딩 (OCR 검수, 별지 4호) |
| `heading-lg` | 22 / 500 / 1.20 / -0.20px | 카드 타이틀 |
| `heading-md` | 18 / 500 / 1.40 / 0 | 점검 섹션 타이틀 |
| `body-lg` | 17 / 400 / 1.60 / 0 | 도입부 설명 (ink-mute) |
| `body` | 15 / 400 / 1.55 / 0 | 본문 기본 |
| `body-sm` | 14 / 400 / 1.55 / 0 | 폼 입력, 토글 |
| `caption` | 13 / 400 / 1.45 / 0 | 보조 메타 |
| `micro` | 12 / 400 / 1.45 / 0 | 뱃지, 라벨 |
| `mono` | 12~14 / 400 / 1.5 / 0 | 점검번호, 해시, 측정값. `font-variant-numeric: tabular-nums` 적용 |

### 6A.4 스페이싱 / 모서리 / 섀도우 토큰

```css
/* spacing — 8pt 기반 (Supabase 동일) */
--xxs: 2px;  --xs: 4px;   --sm: 8px;   --md: 12px;
--lg: 16px;  --xl: 24px;  --xxl: 32px; --huge: 64px;

/* radius — pill 금지 (Supabase 원칙) */
--r-xs: 4px;  --r-sm: 6px;  --r-md: 8px;
--r-lg: 12px; --r-xl: 16px; --r-full: 9999px;  /* full은 아바타·pill dot 외 사용 금지 */

/* shadow — 절제 */
--shadow-sm: 0 1px 2px rgba(0,0,0,.04);
--shadow-md: 0 2px 8px rgba(0,0,0,.06);
```

### 6A.5 컴포넌트 규칙 (요약)

- **버튼**: `btn-primary` (그린 배경 + 흰 글자), `btn-outline` (화이트 배경 + hairline-strong 테두리), `btn-ghost` (배경 없음, hover 시 canvas-soft). pill 금지, radius `--r-sm` (6px).
- **카드**: `--canvas` + 1px `--hairline` 테두리 + `--r-lg` (12px). hover 시 `--hairline-strong`로 강조. shadow는 강조용으로만.
- **Pill 뱃지**: `--r-full`. dot + label 조합 사용. 컬러는 semantic 토큰(`pass/fail/warn`)에 한정.
- **테이블/체크리스트 행**: 행 사이 `--hairline-cool` 구분선만. zebra 줄무늬 금지(Supabase 톤).
- **네비 active 상태**: `--primary-soft` 배경 + 왼쪽 3px `--primary` 액센트 바. 다크 배경 active 금지(어두운 면이 늘어나면 그린 신호성이 죽음).
- **OCR 뱃지 5종**: `extracted`(회색), `confirmed`(그린), `edited`(블루), `low-confidence`(앰버), `missing`(레드) — `--r-xs` 4px, padding `3px 8px`.

### 6A.6 인쇄(별지 9호/4호) ↔ 화면 톤 분리

- 화면 UI는 §6A 토큰을 따른다.
- **인쇄 양식(`app/print/...`)은 §6 인쇄 표준만 따르고 §6A 컬러를 적용하지 않는다.** 별지 양식은 흑백 단색 인쇄가 표준이며, 그린 액센트 등을 인쇄물에 노출하지 않는다.
- `app/print/...` 라우트는 `apps/web/styles/print.css`만 로드, `globals.css`(토큰 CSS)는 로드하지 않음.

## 7. v2 협업 대비 데이터 자리 (지금 확보)

v0.2에서 협업 락·충돌 감지 필드를 정식 entity에 통합. 별도 placeholder 없이 다음 위치에 자리만 확보:

| 위치 | 필드 | 용도 |
|---|---|---|
| `FacilityScope.lockSectionId` (§3.1) | string | 설비 단위 락 식별자. v1은 채워두기만. |
| `InspectionSection.lastEditedBy` / `lastEditedAt` / `lockHolder` (§3.1) | string? | v2 충돌 감지 + 락 점유자. v1은 채워두기만. |
| `Form4Item.lastEditedBy` / `lastEditedAt` / `lockHolder` (§3.2.4) | string? | 점검항목 단위 락(더 세밀한 입도 옵션). v2에서 어느 입도(섹션 vs 항목)로 갈지 결정. |

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

## 9. 구현 순서 (Do 단계 가이드 후보 · v0.2.2 재정렬)

> v0.2 변경: OCR 검수와 설비 추천 검수를 작업지시 동결 앞에 명시. 비용 문서를 별도 단계로 분리. 권한 모델을 인프라 단계에 명시.
> v0.2.2 변경: **step 2 디자인 시스템 토큰 이식**을 부트스트랩 직후로 삽입. UI 화면(step 8+)이 토큰 위에 작성되도록 강제. 이후 단계 번호 +1.

1. **monorepo 부트스트랩**: pnpm workspaces, apps/web (Next.js init), packages 4개(types, fire-data, law-client, ocr-client) 골격
2. **디자인 시스템 토큰 이식 (v0.2.2 신설)**: §6A 토큰을 `apps/web/styles/tokens.css` + `globals.css` + `print.css`로 코드화. Inter + JetBrains Mono 폰트 로드(`@fontsource/inter`, `@fontsource/jetbrains-mono`). 시안 검증: `docs/design-preview/supabase-tone.html`의 색상 값과 1:1 일치.
3. **packages/types**: §3.1 도메인 타입 전부 코드화 (v0.2 신설 엔티티 포함). `apps/web/lib/auth/guard.ts` 단일 role 가드.
4. **packages/fire-data**: 기존 `data/fire-duty-master.json` 로더 + `inspection-checklist.json` 신규 작성 (PoC 7종)
5. **packages/law-client**: 법제처 API 클라이언트 + 스냅샷 IO (먼저 mock으로 시작)
6. **packages/ocr-client (v0.2)**: `manual` provider만 먼저 구현 (빈 extraction 반환). 실제 OCR 엔진은 §10 Open Question 해소 후 추가.
7. **apps/web/lib/domain/ 6함수** 구현: `extractBuildingRegister`, `lookupLawByYear`, `suggestFacilities`, `deriveInspectionScope`, `composeWorkOrder`, `validateInspection`
8. **apps/web 단계 A-1 UI**: 로그인(admin/field) + CustomerCompany/Building/InspectionProject 생성 — §6A 토큰 적용
9. **apps/web 단계 A-2 UI (v0.2)**: 건축물대장 업로드 → OCR 호출 → **검수 화면**(원본 PDF vs 추출 필드 나란히, FieldDiffBadge 표시) → confirm
10. **apps/web 단계 A-3 UI (v0.2)**: `suggestFacilities` 실행 → 추천 설비 검토 화면 (included/excluded/modified/pending)
11. **apps/web 단계 A-4 UI**: 작업지시 검토 + 동결 (composeWorkOrder + hash)
12. **별지 9호 HTML**: 8쪽 정적 레이아웃 + `Form9Data` + `WorkOrder` 바인딩 + `/print/form9` 라우트 (§6 인쇄 표준만 적용, §6A 컬러 비적용)
13. **별지 4호 HTML**: 점검표 7종 정적 레이아웃 + 점검번호 키(`1-A-001` 체계) 바인딩
14. **apps/web 단계 B UI**: 점검 홈(배정 섹션) → 설비별 점검 입력(InspectionResult + FieldNote: 메모/사진/음성/파일) + Discrepancy 로그
15. **비용 문서 (v0.2)**: BillingDocument 입력 + `BillingInvoice.tsx` + `/print/billing/[billingId]` PDF
16. **인쇄 검증**: Chromium headless로 PDF 생성 + 좌표 자동 비교 (form9·form4·billing 3종)

## 10. Open Questions (Design 단계 종료 시 해소 필요 · v0.2 갱신)

### v0.1부터 미해소 (계속 추적)

- [ ] 법제처 OpenAPI 키 발급 절차·할당량 (현재 미확인) → 단계 A-2 구현 직전 확인
- [ ] 별지 4호 32종 중 PoC 7종 최종 확정 (현재 후보 7개) → 파트너 베테랑 의견 + 사용자 결정
- [ ] 다중이용업소 분류(`MultiUseEstablishment`) 타입 enum 정의 → 별지 9호 2쪽 22개 업종 리스트로
- [ ] `BuildingMeta.fireSafetyGrade` 자동 판정 vs 사용자 입력 — 자동 판정은 별도 feature `assess-building-obligations`로 분리할지

### v0.2 신설 (OCR·권한·저장소·비용)

- [ ] **OCR 엔진 선정**: 후보 비교 필요
  - Google Vision (가성비, 한글 정확도 보통)
  - Upstage Document AI (한글 특화, 비용 ↑)
  - Naver Clova OCR (한글 최강, 폐쇄적)
  - → v1 출시 전 1주 PoC로 건축물대장 10건 테스트 후 결정. 결정 전까지 `manual` provider로 진행.
- [ ] **첨부 저장소 운영 정책**: v1 로컬 파일시스템(`data/projects/.../attachments/`)으로 시작 확정. v1 운영 단계에서 디스크 사용량·백업 정책 별도 정의 필요. v2 bkend Storage 마이그레이션 시점은 협업 기능 도입과 함께.
- [ ] **v1 권한 모델 범위 확정**: `admin` / `field` 2역할로 충분한지 파트너 검증. 한 회사 내 admin 1명이 모든 프로젝트 접근 가능한 단순 모델인지, project-scope 권한이 필요한지.
- [ ] **OCR 검수 필수 필드 최소셋**: PRD §7.1에 14개 후보. 설비 추천 룰 입력에 실제로 필요한 최소셋 식별 필요(룰 엔진 코드 작성하면서 확정).
- [ ] **음성 파일 v1 처리**: 저장만 하고 재생 UI는 v1 포함? STT는 v1.5 명확. 재생기는 v1에 넣을지 결정 필요.
- [ ] **세금계산서 PDF 양식**: 표준 세금계산서 양식(국세청 별지)을 그대로 모사할지, 우리 자체 양식을 쓸지. "내부 보관·고객 전달용" 라벨 위치.

## 11. 다음 단계

`/pdca do fire-inspection-system` — 구현 시작 (Phase 1: monorepo 부트스트랩)

병행 작업 권장:
- 데이터셋: `data/fire-duty-master.json` TODO 25개 해소 + `data/inspection-checklist.json` 신규 작성 (PoC 7종)
- Open Questions §10의 OCR 엔진 PoC (1주, 건축물대장 10건 테스트)
