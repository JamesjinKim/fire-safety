# PRD: 소방안전점검 워크플로 시스템

> 문서 상태: **v0.1 (Design v0.2에 통합 완료 — 2026-05-26)**  
> 작성일: 2026-05-25 · 통합 처리일: 2026-05-26  
> 관련 문서: [fire-inspection-system.plan.md](./fire-inspection-system.plan.md), [fire-inspection-system.design.md](../../02-design/features/fire-inspection-system.design.md) (v0.2 — 본 PRD 내용 반영됨), [../../01-overview.md](../../01-overview.md)

> **통합 메모 (2026-05-26)**: 본 PRD v0.1에서 도입한 다음 개념들은 Design v0.2에 모두 반영되었습니다.
> - 사용자/조직 모델 (`Organization`, `User`, admin/field 2역할)
> - 고객사·건물 3계층 (`CustomerCompany` → `Building` → `InspectionProject`)
> - `BuildingRegister` + OCR 검수 단계 + `ExtractedFieldStatus`
> - `SuggestedFacilitySection` (추천) ↔ `WorkOrder` (동결) 분리
> - `InspectionSection` / `InspectionResult` / `FieldNote` 명시
> - `BillingDocument` (세금계산서 형태 PDF, v1.5에서 ASP 전환)
> - OCR v1 범위 포함 결정 (구현 부하 +30% 감수)
>
> 이후 사양 변경은 Design v0.2 또는 신규 PRD vN.N로 진행합니다. 본 문서는 의사결정 컨텍스트 보존용으로 유지됩니다.

---

## 1. 제품 개요

이 제품은 건물주 또는 관리주체가 소방안전 점검을 의뢰한 뒤, 소방안전 점검회사가 건축물대장 기반으로 점검 프로젝트를 만들고, 법정 요건에 맞는 설비별 작업지시를 발행하며, 현장 점검 결과를 별지 제4호서식과 별지 제9호서식으로 완성하고, 최종 비용 문서까지 PDF로 저장하는 Light SaaS다.

핵심 가치는 다음 한 문장으로 정의한다.

> 건축물대장을 올리면, 법정 요건 기반 설비 섹션이 자동 추천되고, 관리자가 검수한 작업지시를 바탕으로 현장 점검과 법정 서식 출력까지 한 프로젝트에서 끝난다.

## 2. 문제 정의

영세 또는 중소 규모의 소방안전 점검회사는 다음 업무를 반복적으로 수작업 처리한다.

- 건축물대장 PDF/이미지에서 점검에 필요한 정보를 읽고 엑셀 또는 한글 문서에 재입력한다.
- 건축년도, 용도, 면적, 층수, 지하층, 높이 등에 따라 적용될 소방시설을 전문가 경험으로 판단한다.
- 별지 제4호서식 점검표와 별지 제9호서식 자체점검 결과보고서를 별도로 작성한다.
- 현장 점검 중 사진, 메모, 음성 기록이 흩어지고, 사무실에서 다시 문장으로 정리한다.
- 점검 완료 후 비용 정보를 별도 문서나 회계 시스템에 다시 입력한다.

기존 통합 ERP형 솔루션은 범위가 넓고 무겁다. 이 제품은 회계, 인사, 재고, 전자결재까지 포함하는 ERP가 아니라, 자체점검 업무의 실제 병목인 **건축물대장 정보화, 법정 설비 추천, 설비별 현장 입력, 법정 서식 출력**에 집중한다.

## 3. 대상 사용자

### 3.1 v1 사용자

| 사용자 | 설명 | v1 권한 방향 |
|---|---|---|
| 관리자 | 소방안전 점검회사 사무실 담당자. 고객사, 건물, 프로젝트, 작업지시, 최종 서식, 비용 문서를 관리한다. | 전체 프로젝트 생성·검수·출력 |
| 현장 사용자 | 현장 팀장 또는 점검자. 배정된 작업지시를 확인하고 설비별 점검 결과를 입력한다. | 점검 결과·메모·첨부 입력 |

v1은 현장 팀장과 점검자를 모두 로그인 사용자로 열어 둔다. 다만 초기에는 권한을 과도하게 세분화하지 않고, `관리자`와 `현장 사용자` 중심의 단순 모델로 시작한다. 이후 팀장, 점검자, 검토자, 대표자 권한 분리로 확장할 수 있도록 데이터 구조에는 역할 필드를 둔다.

### 3.2 v1에서 직접 사용자로 보지 않는 대상

| 대상 | v1 처리 방식 |
|---|---|
| 고객사/건물주 | 로그인 사용자가 아니라 고객사·청구 대상·점검 대상 데이터로 관리 |
| 회계 담당자 | 관리자 역할에 포함 |
| 외부 기관 | 제출 연동 없음. 법정 양식 PDF/인쇄물 생성까지만 지원 |

## 4. 제품 원칙

### 4.1 자동화는 초안, 법정 판단은 확정값

OCR과 자동 추천은 사용자의 입력 부담을 줄이기 위한 기능이다. 그러나 법정 요건 산출과 작업지시 생성에는 관리자가 확인한 확정값만 사용한다.

### 4.2 설비 섹션 자동 추천 + 관리자 검수 + 작업지시 동결

사용자가 처음부터 점검 설비를 수동 선택하지 않는다. 시스템은 건축물대장 확정값과 법령·설비 기준 데이터베이스를 바탕으로 적용 가능성이 높은 설비 섹션을 자동 추천한다. 관리자는 추천 결과를 검토하고 실제 작업지시에 포함할 설비를 확정한다. 확정된 작업지시는 동결되며, 현장에서 달라진 내용은 변경 로그로 남긴다.

### 4.3 현장 입력 단위는 설비별

현장 점검 입력은 점검자별 또는 구역별이 아니라 별지 제4호서식의 구조에 맞춰 설비별 섹션으로 구성한다. 예: 소화기구, 옥내소화전설비, 자동화재탐지설비, 피난기구, 유도등, 비상조명등, 다중이용업소.

### 4.4 계산·판정은 결정론적 코드

법령 매칭, 설비 추천, 별지 서식 데이터 조립은 결정론적 코드와 검증된 기준 데이터로 처리한다. LLM은 v1에서 법정 판단에 사용하지 않는다.

### 4.5 현장 기록의 그릇은 v1에 둔다

v1은 텍스트 메모, 사진, 음성 파일, 기타 첨부를 설비별로 저장할 수 있게 한다. 음성 인식, AI 문장 정리, 별지 서식 자동 문장 삽입은 v1.5 이후로 분리한다.

## 5. v1 범위

### 5.1 포함 기능

| 영역 | v1 기능 |
|---|---|
| 로그인 | 관리자와 현장 사용자 로그인 |
| 고객사 관리 | 고객사/건물주 기본 정보 저장 |
| 건물 관리 | 점검 대상 건물 정보 저장 |
| 건축물대장 업로드 | PDF 또는 이미지 업로드 |
| OCR 초안 생성 | 주요 건축물 정보 자동 추출 |
| OCR 검수 | 원본과 추출값을 비교하여 관리자가 필수 필드 확정 |
| 설비 추천 | 확정된 건축물 정보를 기준으로 법정 요건 기반 설비 섹션 자동 추천 |
| 작업지시 | 관리자가 추천 설비를 포함/제외/수정 후 작업지시 동결 |
| 현장 입력 | 현장 사용자가 설비별 점검 결과 입력 |
| 현장 기록 | 설비별 텍스트 메모, 사진, 음성 파일, 기타 파일 첨부 |
| 별지 출력 | 별지 제4호서식, 별지 제9호서식 HTML 미리보기 및 PDF/인쇄 |
| 비용 문서 | 관리자 입력값 기반 세금계산서 형태 PDF 생성 |

### 5.2 제외 기능

| 기능 | 제외 사유 | 후보 단계 |
|---|---|---|
| 고객사 포털 | v1 핵심 사용자 아님 | v2 이후 |
| 실제 국세청 전자세금계산서 발행 | 인증·세무 연동 복잡도 큼 | v1.5 이후 |
| 회계/정산 시스템 | Light SaaS 범위 초과 | v2 이후 |
| AI 음성 인식/문장 정리 | v1은 기록 수집까지만 | v1.5 이후 |
| Google Drive 자동 저장 | 저장소 연동 정책 필요 | v1.5 이후 |
| 다중 점검자 실시간 협업 | 락/동시성 설계 필요 | v2 이후 |
| 소방청 제출 시스템 연동 | 기관 연동 검토 필요 | v2 이후 |
| 9대 의무 통합 ERP | 제품 포지셔닝과 다름 | 영구 배제 또는 별도 제품 |

## 6. 주요 업무 흐름

### 6.1 전체 흐름

```text
고객사 점검 의뢰
→ 고객사/건물 등록
→ 건축물대장 PDF/이미지 업로드
→ OCR 초안 생성
→ 관리자 필수 필드 검수·확정
→ 법정 요건 기반 설비 섹션 자동 추천
→ 관리자 추천 결과 검토·수정
→ 작업지시 동결
→ 현장 사용자가 설비별 점검 결과 입력
→ 불량사항·메모·사진·음성 기록 저장
→ 별지 제4호/제9호 자동 구성
→ 관리자 최종 검토
→ PDF/인쇄 저장
→ 비용 입력
→ 세금계산서 형태 PDF 저장
```

### 6.2 건축물대장 OCR 및 검수

1. 관리자가 건축물대장 PDF 또는 이미지를 업로드한다.
2. 시스템이 OCR 또는 문서 분석으로 주요 필드를 추출한다.
3. 추출값은 `초안` 상태로 표시한다.
4. 관리자는 원본과 추출값을 나란히 보며 필수 필드를 확인한다.
5. 모든 필수 필드가 확정되기 전에는 설비 추천 버튼을 비활성화한다.
6. 확정된 값만 `BuildingMeta`로 저장하고 설비 추천 룰 엔진에 전달한다.

### 6.3 설비 추천 및 작업지시 동결

1. 시스템이 확정된 건축물 정보와 기준 데이터베이스를 비교한다.
2. 적용 가능성이 높은 설비 섹션 목록을 추천한다.
3. 각 추천에는 추천 사유, 법적 근거, 신뢰 상태를 함께 표시한다.
4. 관리자는 추천 설비를 포함, 제외, 수정, 현장 확인 필요로 표시할 수 있다.
5. 확정된 설비 섹션 목록으로 작업지시를 발행한다.
6. 발행된 작업지시는 해시를 포함한 immutable 스냅샷으로 저장한다.

### 6.4 현장 설비별 점검

1. 현장 사용자는 로그인 후 배정된 프로젝트와 작업지시를 확인한다.
2. 작업지시에 포함된 설비 섹션 목록을 본다.
3. 설비별 점검표에서 각 점검항목의 결과를 입력한다.
4. 결과값은 `적합`, `부적합`, `해당없음`, `미점검` 중 하나로 시작한다.
5. 부적합 항목에는 불량 내용, 조치 필요사항, 사진, 메모, 음성 파일을 연결할 수 있다.
6. 작업지시와 현장 실제가 다르면 변경 사유와 증거를 남긴다.

### 6.5 별지 제4호/제9호 출력

설비별 점검 결과는 별지 제4호서식의 점검항목과 직접 연결된다. 부적합 항목과 불량 내용은 별지 제9호서식의 불량 세부사항으로 자동 집계된다.

출력 원칙:

- HTML 양식은 A4 210mm x 297mm 인쇄를 기준으로 작성한다.
- 별지 제4호 점검번호 체계는 원문 코드 형태를 유지한다. 예: `1-A-007`.
- 별지 제9호와 제4호는 프로젝트별로 저장하고, PDF 또는 인쇄물로 생성할 수 있어야 한다.

### 6.6 비용 입력 및 세금계산서 형태 PDF

점검 완료 후 관리자는 비용 정보를 입력한다. v1은 실제 전자세금계산서 발행이 아니라 내부 보관용 및 고객 전달용 PDF 양식 생성까지 지원한다.

입력 항목 후보:

- 공급자 정보
- 공급받는자 정보
- 품목명
- 수량
- 단가
- 공급가액
- 부가세
- 합계
- 비고

향후 실제 정산 시스템, 전자세금계산서 API, 회계 연동으로 확장할 수 있도록 `BillingDocument` 객체를 별도로 둔다.

## 7. 필수 데이터 필드

### 7.1 건축물대장 검수 필수 필드

설비 추천 실행 전 관리자가 확인해야 하는 최소 필드는 다음과 같다.

| 필드 | 사용 목적 |
|---|---|
| 건물명 | 프로젝트/서식 표시 |
| 소재지 | 별지 제9호 및 고객 식별 |
| 주용도/세부용도 | 설비 적용 기준 |
| 사용승인일 | 법령 시점 판단 후보 |
| 건축허가일 | 법령 시점 판단 후보 |
| 연면적 | 설비 적용 기준 |
| 건축면적 | 서식 및 일부 기준 |
| 지상 층수 | 설비 적용 기준 |
| 지하 층수 | 설비 적용 기준 |
| 높이 | 설비 적용 기준 |
| 세대수 또는 수용 관련 값 | 공동주택/특정 용도 기준 |
| 주차장 정보 | 지하/옥내/필로티 등 판단 |
| 다중이용업소 여부 | 다중이용업소 섹션 판단 |
| 증축/용도변경 이력 여부 | TODO: 검증필요 |

### 7.2 OCR 필드 상태

```typescript
type ExtractedFieldStatus =
  | 'extracted'
  | 'confirmed'
  | 'edited'
  | 'missing'
  | 'low-confidence';
```

## 8. 핵심 도메인 객체

| 객체 | 설명 |
|---|---|
| `Organization` | 소방안전 점검회사 |
| `User` | 관리자 또는 현장 사용자 |
| `CustomerCompany` | 건물주 또는 관리주체 |
| `Building` | 점검 대상 건축물 |
| `BuildingRegister` | 건축물대장 원본, OCR 초안, 관리자 확정값 |
| `InspectionProject` | 고객사·건물·점검 업무를 묶는 프로젝트 |
| `SuggestedFacilitySection` | 법정 요건 기반 추천 설비 섹션 |
| `WorkOrder` | 관리자가 확정한 작업지시 스냅샷 |
| `InspectionAssignment` | 사용자와 설비 섹션 배정 관계 |
| `Inspection` | 실제 현장 점검 실행 기록 |
| `InspectionSection` | 설비별 점검 단위 |
| `InspectionResult` | 별지 제4호 점검항목별 결과 |
| `Discrepancy` | 작업지시와 현장 실제가 다른 경우의 변경 로그 |
| `FieldNote` | 텍스트, 사진, 음성, 파일 등 현장 기록 |
| `OfficialForm` | 별지 제4호/제9호 출력 데이터 |
| `BillingDocument` | 비용 입력 및 세금계산서 형태 PDF 데이터 |

## 9. 데이터 모델 초안

### 9.1 BuildingRegister

```typescript
interface BuildingRegister {
  id: string;
  projectId: string;
  sourceFileId: string;
  extraction: BuildingRegisterExtraction;
  confirmationStatus: 'pending' | 'confirmed';
  confirmedBy?: string;
  confirmedAt?: string;
  confirmedBuildingMeta?: BuildingMeta;
}
```

### 9.2 SuggestedFacilitySection

```typescript
interface SuggestedFacilitySection {
  id: string;
  projectId: string;
  facilityCode: string;
  facilityName: string;
  reason: string;
  legalBasis: LawCitation[];
  confidence: 'high' | 'needs-review';
  reviewStatus: 'included' | 'excluded' | 'modified' | 'pending';
  reviewedBy?: string;
  reviewedAt?: string;
}
```

### 9.3 InspectionSection

```typescript
interface InspectionSection {
  id: string;
  inspectionId: string;
  facilityCode: string;
  facilityName: string;
  checklistFormCode: string;
  assignedUserIds: string[];
  status: 'not-started' | 'in-progress' | 'completed' | 'needs-review';
  results: InspectionResult[];
  notes: FieldNote[];
}
```

### 9.4 InspectionResult

```typescript
interface InspectionResult {
  id: string;
  sectionId: string;
  checklistItemCode: string;
  result: 'pass' | 'fail' | 'not-applicable' | 'not-checked';
  defectDescription?: string;
  actionRequired?: string;
  attachmentIds?: string[];
  updatedBy: string;
  updatedAt: string;
}
```

### 9.5 FieldNote

```typescript
interface FieldNote {
  id: string;
  projectId: string;
  inspectionId: string;
  sectionId: string;
  checklistItemCode?: string;
  type: 'text' | 'voice' | 'photo' | 'file';
  title?: string;
  memo?: string;
  attachmentIds: string[];
  createdBy: string;
  createdAt: string;
}
```

### 9.6 BillingDocument

```typescript
interface BillingDocument {
  id: string;
  projectId: string;
  customerCompanyId: string;
  status: 'draft' | 'issued' | 'voided';
  billingType: 'tax-invoice-draft' | 'quotation' | 'receipt';
  supplier: BillingParty;
  recipient: BillingParty;
  lineItems: BillingLineItem[];
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  memo?: string;
  pdfFileId?: string;
  createdBy: string;
  createdAt: string;
  issuedAt?: string;
}
```

## 10. 화면 후보

| 화면 | 목적 |
|---|---|
| 로그인 | 사용자 인증 |
| 프로젝트 목록 | 점검 프로젝트 상태 확인 |
| 고객사/건물 등록 | 고객사와 점검 대상 건물 생성 |
| 건축물대장 업로드 | PDF/이미지 업로드 |
| OCR 검수 | 원본과 추출 필드 비교·확정 |
| 설비 추천 검토 | 자동 추천 설비 포함/제외/수정 |
| 작업지시 상세 | 작업지시 발행 전 최종 확인 |
| 현장 점검 홈 | 배정된 프로젝트/설비 섹션 확인 |
| 설비별 점검 입력 | 점검 결과, 불량 내용, 메모, 첨부 입력 |
| 불량사항 요약 | 부적합 항목 집계 |
| 별지 제4호 미리보기 | 점검표 출력 확인 |
| 별지 제9호 미리보기 | 자체점검 결과보고서 출력 확인 |
| 비용 입력 | 품목·금액·세액 입력 |
| 세금계산서 형태 PDF 미리보기 | 내부 보관용/고객 전달용 PDF 생성 |

## 11. 성공 기준

v1 성공 기준은 다음 시나리오가 끊기지 않고 동작하는 것이다.

- [ ] 관리자가 건축물대장 PDF 또는 이미지를 업로드한다.
- [ ] 시스템이 주요 필드 OCR 초안을 생성한다.
- [ ] 관리자가 필수 필드를 확인하기 전에는 설비 추천을 실행할 수 없다.
- [ ] 필수 필드 확정 후 시스템이 설비 섹션을 자동 추천한다.
- [ ] 관리자가 추천 결과를 검토하고 작업지시를 동결한다.
- [ ] 현장 사용자가 로그인하여 설비별 점검 결과를 입력한다.
- [ ] 부적합 항목에 사진, 텍스트 메모, 음성 파일을 첨부할 수 있다.
- [ ] 입력 결과가 별지 제4호서식과 별지 제9호서식으로 연결된다.
- [ ] 별지 양식이 A4 기준 HTML/PDF로 저장된다.
- [ ] 관리자가 비용을 입력하고 세금계산서 형태 PDF를 생성한다.

## 12. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| OCR 오인식 | 설비 추천 오류 가능 | 관리자 필수 확인 전 추천 실행 금지 |
| 법정 설비 추천 룰 불완전 | 법적 리스크 | 추천 사유·법적 근거·검수 상태 표시, TODO: 검증필요 라벨 |
| 실제 설치 현황과 법정 추천 불일치 | 현장 혼선 | 작업지시 동결 후 현장 변경 로그로 기록 |
| 별지 양식 인쇄 오차 | 제출 문서 품질 저하 | A4 1:1 HTML/CSS 표준, 인쇄 검증 |
| 권한 모델 과설계 | v1 개발 지연 | 관리자/현장 사용자 2역할로 시작, 확장 필드만 확보 |
| AI 기능 기대 과대 | v1 범위 증가 | v1은 기록 수집, AI 정리는 v1.5로 명시 |
| 세금계산서 법적 오해 | 실제 전자발행으로 오인 | PDF 양식 생성 수준임을 UI와 문서에 명시 |

## 13. 후속 확장 로드맵

### v1.5 후보

- 음성 파일 텍스트 변환
- AI 문장 정리 및 관리자 검수
- Google Drive 또는 외부 저장소 자동 저장
- 세금계산서 ASP/API 연동 검토
- 견적서, 거래명세서, 정산 문서 확장

### v2 후보

- 현장 팀장/점검자/검토자 권한 세분화
- 다중 점검자 실시간 협업
- 고객사 포털
- 소방청 제출 연동 검토
- NFPC/NFTC 기술기준 데이터 확장
- 더 넓은 법령 시계열 데이터 구축

## 14. 다음 검토 안건

전문가 검토 회의에서는 다음 질문을 우선 확인한다.

1. 건축물대장에서 설비 추천에 꼭 필요한 필드는 무엇인가?
2. 사용승인일과 건축허가일 중 어떤 값을 기본 법령 시점 판단 키로 삼아야 하는가?
3. v1 설비 추천 룰의 최소 범위는 어디까지인가?
4. 별지 제4호서식 32종 중 v1 우선 설비 섹션은 무엇인가?
5. 작업지시와 현장 실제가 다를 때 어떤 변경 사유를 필수로 남겨야 하는가?
6. 세금계산서 형태 PDF에 반드시 포함해야 할 실무 항목은 무엇인가?
