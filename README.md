# 소방안전점검 워크플로 시스템

> **9대 의무 다 안 합니다. 자체점검 일지·보고서만은 한국에서 가장 정확하고 가장 가볍게.**
> 가입은 3분, 구독은 셀프, 점검 한 건은 30분.

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
| 데이터 | `data/fire-duty-master.json` (법정문서 SSoT) + `data/inspection-checklist.json` (별지 4호 점검항목) |
| 법령 시계열 | 법제처 OpenAPI를 **단계 A(사무실)에서만** 호출 → 작업지시에 동결 |
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
| [docs/01-plan/features/group-call-ai-roadmap.plan.md](docs/01-plan/features/group-call-ai-roadmap.plan.md) | [미래] 그룹 통화 & AI 자동완성 로드맵 Plan |
| [docs/02-design/features/fire-inspection-system.design.md](docs/02-design/features/fire-inspection-system.design.md) | Design — 도메인 모델·디렉토리·인쇄 표준 |
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
└── reference/           ← 소방 법령·서식 PDF
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
- [x] fire-inspection-system Plan / Design 작성
- [ ] Open Questions 해소 (법제처 API 키·PoC 점검표 최종 7종·등급 자동판정 분리 여부)
- [ ] Do Phase 1: monorepo 부트스트랩 (apps/web, packages/{types,fire-data,law-client})
- [ ] 별지 9호/4호 HTML 양식 (A4 1:1) + 세금계산서 PDF 떨어뜨림
- [ ] 파트너 주 1회 정기 리뷰 시작, v1 완성 직후 2번째 파트너 탐색
