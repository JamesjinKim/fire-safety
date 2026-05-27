# 소방안전점검 워크플로 시스템

> **9대 의무(업무) 다 안 합니다. 자체점검 일지·보고서만은 한국에서 가장 정확하고 가장 가볍게.**
> 가입은 3분, 구독은 셀프, 점검 한 건은 30분.

# 소방안전관리 9대 업무 내용

1. 피난계획에 관한 사항과 소방계획서의 작성 및 시행

    화재 발생 시 인명 피해를 최소화하기 위한 피난 경로 설정과 전반적인 소방 운영 계획 수립.

2. 자위소방대 및 초기대응체계의 구성, 운영 및 교육

    입주민이나 직원들로 구성된 비상 대응팀을 조직하고, 실제 상황 발생 시 초기 진압과 대피를 돕는 체계 구축.

3. 피난시설, 방화구획 및 방화시설의 유지·관리

    비상구, 계단, 방화셔터 등이 정상 작동하도록 상시 점검하고 적치물을 제거.

4. 소방시설이나 그 밖의 소방 관련 시설의 유지·관리

    스프링클러, 소화기, 경보 설비 등 소방 설비의 정상 가동 상태 유지.

5. 화기취급의 감독

    화기 사용 시 안전 수칙 준수 여부를 확인하고 위험 요소를 사전에 차단.

6. 소방훈련 및 교육

    거주자나 근무자를 대상으로 한 정기적인 대피 훈련 및 소방 안전 교육 실시.

7. 화재발생 시 홍보 및 응급조치

    화재 상황 전파 및 환자 발생 시 응급 처치 지원.

8. 소방안전관리 업무에 관한 기록의 유지

    점검 기록, 교육 내역 등 수행한 모든 안전관리 업무를 서면이나 전자 문서로 기록·보존(보통 2년).

9. 그 밖에 소방안전관리에 필요한 업무

    법령에서 정하는 추가적인 안전 조치 및 소방본부장/소방서장의 지도 사항 이행.

# 핵심 참고 사항
    위반 시 불이익: 소방안전관리 업무를 게을리할 경우 300만 원 이하의 과태료가 부과될 수 있으며, 화재 발생 시 관리 소홀이 입증되면 민·형사상 책임이 무거워질 수 있습니다.

    특히 최근에는 '초기대응체계'의 중요성이 강조되고 있어, 단순히 계획서만 만드는 것이 아니라 실제 훈련을 통해 대응 역량을 갖추는 것이 실무에서 가장 중요합니다.
---

## 한 줄 정의

영세 점검업체가 무거운 ERP에 돈 쓰지 않고도, 건축물대장 → 그 시점 소방법령 매칭 →
**법정 양식(별지 9호/4호) 자동 골격 생성** → 현장 채움 → A4 1:1 인쇄까지 셀프로 끝낸다.
변경 사항은 자동 추적되고, 청구는 PDF로 떨어진다.

핵심 원칙: **계산·판정은 코드가 정확히, LLM은 해석·설명만** (할루시네이션 차단).

> 라이팅넷·세정 같은 통합 ERP SaaS와는 **의도적으로 다른 시장**을 본다.
> 자세한 시장 진단·전략은 메모리 `market-strategy` 참조.

## 빌드 전략 (확정 · 2026-05-23 피벗 반영)

| 항목 | 결정 |
|------|------|
| 방식 | **웹앱 (Next.js)** — v1 단일 인터페이스 |
| 코드 출발점 | **Greenfield** — 처음부터 새로 작성 (건설안전 OSS fork 안 함, 설계 패턴만 참고) |
| 웹앱 스택 | Next.js App Router + RSC · pnpm workspaces |
| 웹서버 임대/배포 | **Vercel 우선** — Function region `icn1`(Seoul), 불가 시 `hnd1`/`sin1`. DB/Storage는 Supabase Seoul |
| 데이터 | `data/fire-duty-master.json` (법정문서 SSoT) + `data/inspection-checklist.json` (별지 4호 점검항목) |
| 법령 시계열 | **고객 키 기반 스냅샷 수집(BYOK)**. 고객 관리자가 자기 법제처 API 키로 필요한 법령 스냅샷을 생성·업로드 → 우리 룰 엔진이 설비 추천 |
| 법제처 API 키 | 서버에 보관하지 않음. 고객 관리자 세션에서 스냅샷 생성 때만 사용하고 저장하지 않음 |
| MCP | **v2 후보로 보류** (v1은 웹앱 내부 함수로 동일 로직 구현, 실수요 검증 후 얇은 MCP 래퍼 부활) |
| RAG | **폐기** (숫자 기준 환각 위험, 본 도메인은 결정론적 룰 계산이 본질) |

## 사용자 흐름 (두 단계)

```
[단계 A: 사무실 / 관리자]                         [단계 B: 현장 / 점검자]
 1. 건축물대장 입력                                 1. 작업지시 기준으로 점검
 2. 건축년도 → 그 시점 소방법령 매칭                 2. 실제 시설 ≠ 작업지시 시
 3. 작업지시 문서 동결 ──────────[immutable]───▶     즉시 수정 + 변경 로그
                                                  3. 별지 9호/4호 양식 채움
                                                  4. A4 1:1 인쇄
```

## 문서 구조

| 문서 | 내용 |
|------|------|
| [docs/01-overview.md](docs/01-overview.md) | 프로젝트 개요·문제 정의·의사결정 이력 (피벗 포함) |
| [docs/visual-proposal.html](docs/visual-proposal.html) | [시각화] 대기업 제안서 스타일 인터랙티브 기획안 (HTML) |
| [docs/01-plan/features/fire-inspection-system.plan.md](docs/01-plan/features/fire-inspection-system.plan.md) | 상위 Plan — 워크플로·범위·리스크 |
| [docs/01-plan/features/fire-inspection-system.prd.md](docs/01-plan/features/fire-inspection-system.prd.md) | PRD v0.1 — 제품 요구사항 (Design v0.2에 통합 완료, 컨텍스트 보존용) |
| [docs/01-plan/features/group-call-ai-roadmap.plan.md](docs/01-plan/features/group-call-ai-roadmap.plan.md) | [미래] 그룹 통화 & AI 자동완성 로드맵 Plan |
| [docs/02-design/features/fire-inspection-system.design.md](docs/02-design/features/fire-inspection-system.design.md) | **Design v0.2** — 도메인 모델·디렉토리·인쇄 표준 (PRD 통합 + OCR v1) |
| [docs/01-plan/features/fire-duty-master.plan.md](docs/01-plan/features/fire-duty-master.plan.md) | 하위 데이터셋 Plan (법정문서 SSoT) |
| [docs/02-design/features/fire-duty-master.design.md](docs/02-design/features/fire-duty-master.design.md) | 하위 데이터셋 Design |
| [docs/_archive/2026-05-21/](docs/_archive/2026-05-21/) | 워크플로 피벗으로 보류된 자료 (MCP 설계·현장 웹앱·프로토타입) |



## 폴더 구조

```
fire-safety/
├── README.md            ← 이 파일 (진입점)
├── docs/                ← PDCA 문서 + 의사결정 이력
│   ├── 01-overview.md
│   ├── 01-plan/features/
│   ├── 02-design/features/
│   └── _archive/2026-05-21/    ← 보류 자료
├── data/                ← 산출 데이터
│   ├── fire-duty-master.json
│   └── validate-master.mjs
│── html/
│   ├── 별지_제4호서식.html
│   └── 별지_제9호서식.html
└── reference/   ← 소방 법령·서식 PDF  # 참고용 자료임. PDF 큰 파일 읽기 금지ㅈ !!
    ├── 소방기본법.pdf
    ├── 소방시설법 및 화재예방법령집.pdf
    ├── 별지 제9호서식.pdf   (자체점검 결과보고서, 8쪽)
    └── 별지 제4호서식.pdf   (점검표, 71쪽 · 32종)
```

## 타겟 (확정)

- **대상물**: 아파트, 일반 빌딩, 상가 (특정소방대상물 1~3급 중심)
- **사용자**: 사무실 관리자 (단계 A) + 현장 점검자 (단계 B)
- **우선 산출물**: 별지 제9호서식(자체점검 결과보고서) + 별지 제4호서식(점검표 PoC 5~7종)
- **핵심 가치**: A4 인쇄 1:1, 변경 로그 추적, 법령 시점 정확성

## 현재 상태 / 다음 단계

- [x] 방향 확정 (웹앱 + greenfield, RAG·MCP-as-1st 폐기)
- [x] 워크플로 피벗 (단계 A / 단계 B 분리)
- [x] 시장 진단·차별 포지셔닝 박제 (Light SaaS, 20년 베테랑 공동개발 파트너 확보)
- [x] fire-inspection-system Plan / Design v0.1 / PRD v0.1 작성
- [x] **Design v0.2 갱신** (2026-05-26): PRD v0.1 통합 + OCR v1 편입. 사용자·고객사·BuildingRegister·SuggestedFacilitySection·InspectionSection·BillingDocument 명시화
- [x] **Design v0.2.2 디자인 시스템 톤 확정** (2026-05-26): Supabase 톤 기반 + Pine Green `#2F9E44` primary. §6A 토큰 박제. 시안: [docs/design-preview/supabase-tone.html](docs/design-preview/supabase-tone.html)
- [ ] Open Questions 해소: **OCR 엔진 선정 PoC (1주, 건축물대장 10건)**, 고객 키 기반 법령 스냅샷 생성/업로드 UX, PoC 점검표 7종 최종 확정, v1 권한 범위 검증
- [ ] Do Phase 1-2: monorepo 부트스트랩 + **디자인 시스템 토큰 이식** (apps/web, packages/{types,fire-data,law-client,**ocr-client**}, apps/web/styles/{tokens,globals,print}.css)
- [ ] 데이터셋: `data/fire-duty-master.json` TODO 25개 + `data/inspection-checklist.json` 신규 (PoC 7종)
- [ ] 별지 9호/4호 HTML 양식 (A4 1:1) + 세금계산서 형태 PDF
- [ ] 파트너 주 1회 정기 리뷰 시작, v1 완성 직후 2번째 파트너 탐색
