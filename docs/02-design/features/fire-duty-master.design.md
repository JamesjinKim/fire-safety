# Design: fire-duty-master (소방 법정문서 마스터 데이터)

> PDCA Design 문서 · feature: `fire-duty-master` · 작성 2026-05-21
> Plan: [../../01-plan/features/fire-duty-master.plan.md](../../01-plan/features/fire-duty-master.plan.md)
> 법령 검증 출처: [reference/소방시설법 및 화재예방법령집.pdf](../../../reference/) (시행 2024.12.1 기준)

---

## 1. 설계 목표

`fire-duty-master.json` — 소방 법정문서/의무의 단일 진실 공급원(SSoT). 웹앱 룰 엔진, 출력물, 향후 자동화 래퍼가 공통으로 참조한다.
이 문서는 **JSON 스키마 + 실제 노드 데이터 구조 + 검증 규칙 + 산출 위치**를 확정한다.

## 2. 파일 위치 (확정)

```
data/
└── fire-duty-master.json     ← SSoT (이 feature의 산출물)
```
> 현 단계는 `data/`에 둔다. 앱 구현 시 `packages/fire-data` 로더가 이 파일을 읽어 룰 엔진과 화면에 제공한다.

## 2.5 법령 데이터 활용 방식 (핵심 결정)

> 구분: `fire-duty-master.json`은 서비스가 관리하는 **정적 법정문서/의무 마스터**다.
> 건축물 사용승인일별 본문 조회에 쓰는 프로젝트 법령 스냅샷은 `fire-inspection-system`의
> 고객 BYOK 수집 흐름(`law_snapshots`)에서 관리한다.

**런타임은 PDF를 실시간으로 읽지 않는다.** 법령 원천은 빌드 타임에 한 번 사람이 추출·검증하여
구조화된 SSoT(`fire-duty-master.json`)로 만들고, 웹앱 런타임은 이 JSON에서 파생된 정적 데이터를 조회한다.

```
[원천]                  [빌드 타임, 1회 수동]          [런타임]
reference/PDF      ─┐
법제처 law.go.kr   ─┼─→ 추출·검증·구조화 ─→ fire-duty-master.json ─→ 웹앱 룰 엔진/화면 조회
nfsc.go.kr(NFTC)   ─┘   (사람이 검증)        (서비스 내장 SSoT)       (네트워크 0, ms)
```

법령은 두 용도로 갈린다:
1. **규칙(rule)** = 면적·층수·등급 등 판정 기준 → 텍스트 아닌 **결정론적 코드(if/else)로 박제**
   (별도 feature `assess-building-obligations`). PDF는 그 코드의 `source` 근거로 인용.
2. **참조(reference)** = 조문 본문·벌칙·기한 → 본 마스터의 `legalRef`·`penaltyOnMissing` 필드에
   **검증된 텍스트로** 저장. 화면과 출력물이 그대로 인용 출력.

> 출처는 **법제처(law.go.kr)**가 법령 본문의 공식 원천이다. (대법원은 판례 — 본 프로젝트 범위 밖)
> NFPC/NFTC는 소방청 고시라 법제처 미등재 → nfsc.go.kr 별도 수집 (본 feature 범위 밖).

### 갱신 전략 (확정: 수동 갱신 — PoC 단계)
- 법 개정 시 우리가 PDF/법제처에서 추출·검증해 JSON을 수정한다.
- 모든 노드는 `_meta.effectiveBasis`(시행일)를 가지며, 도구는 "이 데이터는 ○○ 시행 기준"을 항상 표시.
- 자동 개정 모니터링(법제처 API 주기 비교)은 **운영 단계 과제로 분리** (현 단계 범위 밖).

## 3. JSON 스키마 (확정)

### 3.1 루트 구조
```jsonc
{
  "_meta": {
    "version": "0.1.0",
    "compiled": "2026-05-21",
    "domain": "소방안전점검",
    "scope": "소방시설법 + 시행령 + 시행규칙 + 화재예방법 (타겟: 아파트·빌딩·상가 1~3급)",
    "sources": ["법제처 국가법령정보센터", "reference/소방시설법 및 화재예방법령집.pdf"],
    "effectiveBasis": "시행 2024-12-01",
    "fieldSchema": { /* 아래 3.2 필드 정의 */ }
  },
  "documents": [ /* 문서 노드 배열 */ ]
}
```

### 3.2 문서 노드 필드 (확정)
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| `docId` | string | ✅ | snake_case 고유 식별자 |
| `title` | string | ✅ | 한글 정식 명칭 |
| `category` | enum | ✅ | `A_체제` `B_계획` `C_교육훈련` `G_점검` `K_사고` |
| `legalRef` | string[] | ✅ | `법령약칭:조` 형식 배열 (예: `소방시설법:22`) |
| `formStrictness` | enum | ✅ | `법령강제` `고시` `자율` |
| `formSource` | string | ⬜ | 양식 출처 (별지 서식 번호 등) |
| `frequency` | string | ✅ | 점검·작성 주기 |
| `applicableScope` | string | ✅ | 적용 대상물 범위 |
| `submitTo` | string | ⬜ | 제출처 (소방본부장/소방서장 등) |
| `submitDeadline` | string | ⬜ | 제출 기한 |
| `retention` | string | ⬜ | 보존 기간 |
| `penaltyOnMissing` | string | ⬜ | 미이행 벌칙 (조문) |
| `source` | string | ✅ | 검증 출처 (PDF 페이지/법제처 URL). 미확인 시 `"TODO: 검증필요"` |

> **환각 차단 규칙**: `legalRef`·`penaltyOnMissing`·`retention`은 출처 확인 전 추정 금지.
> 미확인은 값에 `"TODO: 검증필요"` 명시. 도구는 TODO 값을 사용자에게 그대로 노출.

## 4. 노드 데이터 — 검증 완료분

> 아래는 reference/ PDF(시행 2024.12.1)에서 **직접 확인한** 사실만 채움. 미확인은 TODO.

### 4.1 자체점검 결과보고서 (작동점검) ✅ 핵심 산출물
```jsonc
{
  "docId": "self_inspection_report_operational",
  "title": "소방시설등 자체점검 결과보고서(작동점검)",
  "category": "G_점검",
  "legalRef": ["소방시설법:22", "소방시설법시행규칙:20", "소방시설법시행규칙:23"],
  "formStrictness": "법령강제",
  "frequency": "연 1회 (작동점검)",
  "applicableScope": "특정소방대상물 (관계인 의무)",
  "submitTo": "소방본부장 또는 소방서장",
  "submitDeadline": "자체점검이 끝난 날부터 15일 이내 (시행규칙 §23 — TODO: 일수 정밀확인)",
  "retention": "TODO: 검증필요 (별표/시행규칙 확인)",
  "penaltyOnMissing": "소방시설법:61 (300만원 이하 과태료, 세부 별표10 — TODO: 해당 호 확인)",
  "source": "reference PDF 법 제22조·시행규칙 제20조 (시행 2024.12.1)"
}
```
> 확인됨: 법§22 관계인 자체점검 의무, 시행규칙§20 구분·대상·별표3(준수사항)·별표4(점검인력 배치).
> 점검 후 결과 제출 의무 존재. 정확한 제출기한 일수는 시행규칙§23 본문 정밀확인 필요(TODO).

### 4.2 자체점검 결과보고서 (종합점검) ✅
```jsonc
{
  "docId": "self_inspection_report_comprehensive",
  "title": "소방시설등 자체점검 결과보고서(종합점검)",
  "category": "G_점검",
  "legalRef": ["소방시설법:22", "소방시설법시행규칙:20"],
  "formStrictness": "법령강제",
  "frequency": "연 1회 (종합점검 대상물) — TODO: 대상 기준 확인",
  "applicableScope": "종합점검 대상 특정소방대상물 (별표3 기준 — TODO)",
  "submitTo": "소방본부장 또는 소방서장",
  "retention": "TODO: 검증필요",
  "penaltyOnMissing": "소방시설법:61 (TODO: 해당 호)",
  "source": "reference PDF 법 제22조·시행규칙 제20조"
}
```

### 4.3 자체점검 면제·연기 신청서 ✅
```jsonc
{
  "docId": "self_inspection_exemption_deferral_request",
  "title": "소방시설등 자체점검 면제 또는 연기 신청서",
  "category": "G_점검",
  "legalRef": ["소방시설법시행령:33", "소방시설법시행규칙:22"],
  "formStrictness": "법령강제",
  "formSource": "시행규칙 별지 면제·연기신청서 (TODO: 별지번호)",
  "frequency": "수시 (사유 발생 시)",
  "applicableScope": "재난 발생·소유권 변동·부도/도산 등 사유 발생 대상물 (시행령 §33)",
  "submitTo": "소방본부장 또는 소방서장",
  "source": "reference PDF 시행령 제33조·시행규칙 제22조"
}
```

## 5. 노드 데이터 — 추가 예정 (TODO 골격만)

| docId | title | 우선 검증 대상 |
|-------|-------|------|
| `fire_safety_plan` | 소방계획서 | 화재예방법 조문 (별도 PDF 없음 — 법제처 확인) |
| `fire_drill_education_record` | 소방훈련·교육 결과 기록부 | 화재예방법 |
| `fire_safety_manager_appointment` | 소방안전관리자 선임 신고 | 화재예방법 |

> 화재예방법 본문은 reference PDF에 포함됨 — Do 단계에서 해당 조문 추출·검증 후 채운다.

## 6. 검증 규칙 (Check 단계 판정 기준 구체화)

1. JSON 파싱 성공 + 필수 필드(`docId·title·category·legalRef·formStrictness·frequency·applicableScope·source`) 누락 0
2. `category`·`formStrictness` 값이 enum 범위 내
3. `legalRef` 각 항목이 `법령약칭:조` 형식
4. 출처 미확인 필드는 반드시 `"TODO: 검증필요"` (빈 추정값 금지)
5. 검증완료 노드(4.x) ≥ 3개, 모든 `legalRef`가 reference PDF에서 확인 가능

## 7. 구현 순서 (Do 단계 가이드)

1. `data/fire-duty-master.json` 생성 — `_meta` + 검증완료 노드 3종(4.1~4.3)
2. 화재예방법 조문 추출 → §5 노드 3종 검증·추가
3. 시행규칙 §23 제출기한, 별표10 과태료 호, 보존기간 정밀확인 → TODO 해소
4. JSON 스키마 유효성 검증 스크립트 (간단한 노드 validator)

## 8. 미해결 TODO 목록 (추적용)
- [ ] 작동점검 결과보고서 제출기한 일수 (시행규칙 §23)
- [ ] 종합점검 대상물 기준 (별표3)
- [ ] 자체점검 미보고 과태료 해당 호 (별표10)
- [ ] 각 문서 보존기간
- [ ] 면제·연기신청서 별지 번호
- [ ] 화재예방법 계열 3종 노드 조문
