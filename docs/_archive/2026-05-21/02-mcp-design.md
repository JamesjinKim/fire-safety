# 02. MCP 서버 설계

> 진입점: [../README.md](../README.md) · 개요: [01-overview.md](01-overview.md)

---

## 1. MCP란 (요약)

MCP(Model Context Protocol)는 LLM이 로컬 데이터·API·도구와 안전하게 통신하는 개방형 프로토콜.
LLM이라는 "뇌"에 **지식(Resources)**과 **손발(Tools)**을 달아주는 규격.

- **Resources**: LLM이 읽는 읽기전용 데이터 (소방법령 텍스트, NFTC 기준 파일).
- **Tools**: LLM이 실행해 결과를 얻는 백엔드 함수 (등급 계산기, 보고서 합성).
- **Prompts**: 역할 지시 템플릿 ("소방 기사 역할로 답해줘").

```text
Claude Desktop  ──(Tool Call)──>  소방안전점검 MCP 서버 (TS/Node)
   (LLM Host)   <──(Context)────       │            │
                                   [소방법령 번들]  [계산 룰]
```

## 2. 3계층 아키텍처

```
Dynamic Layer : LLM 호스트 (Claude Desktop) / 현장 웹앱
      │ Tool Call (stdio transport, @modelcontextprotocol/sdk)
Kinetic Layer : MCP Tools (결정론적 계산 + 그래프 질의 + 문서 합성)
      │ 참조
Semantic Layer: 온톨로지 (SSoT 마스터 JSON + 법령 번들)
```

## 3. 온톨로지 (Semantic Layer)

소방 도메인 핵심 데이터 연결 그래프:

```
소방대상물(용도/규모/수용인원)
   ├─> 소방안전관리등급(특급/1급/2급/3급) ─> 선임·소방계획서 작성 의무
   └─> 필수 설치 소방시설(소화/경보/피난/소화용수/소화활동설비)
            └─> 점검 항목(작동점검 / 종합정밀점검)
                   ├─> 화재안전기준(NFPC/NFTC 조문)
                   └─> 지적사항·불량 유형 ─> 근거 조문 + 벌칙 + 조치 방법
```

### 3.1 SSoT 마스터 (`fire-duty-master.json` — 신규 설계)
모든 도구의 단일 진실 공급원. 문서 노드 스키마 (건설 OSS에서 차용·소방화):

```jsonc
{
  "docId": "self_inspection_result_report",   // snake_case 식별자
  "title": "소방시설 자체점검 결과보고서",
  "category": "G_점검",                        // 분류 코드
  "legalRef": ["소방시설법:22", "소방시설법시행규칙:20"],  // 근거 법령:조
  "formStrictness": "법령강제",                 // 법령강제/고시/자율
  "frequency": "연 1회(작동) / 연 1회(종합)",     // 점검 주기
  "applicableScope": "특정소방대상물",           // 적용 범위
  "retention": "2년",                          // 보존 기간
  "penaltyOnMissing": "소방시설법:...(과태료)"   // 미이행 벌칙
}
```

## 4. 도구 목록 (Kinetic Layer) — 초안

### 4.1 결정론적 계산 (환각 0 — if/else 룰)
| 도구 | 입력 | 출력 |
|------|------|------|
| `assess_building_fire_obligations` | 용도·연면적·층수·높이·수용인원 | 소방안전관리등급 + 선임/계획서 의무 + 필수 소방시설 목록 |
| `get_inspection_scope` | 대상물 정보 | 작동점검/종합점검 대상 여부·주기·점검 항목 |
| `query_penalty` | docId/조문 | 미이행 시 벌칙·과태료 |

### 4.2 그래프 질의 (마스터 데이터 조회)
| 도구 | 역할 |
|------|------|
| `query_legal_basis` | 문서/항목 → 근거 법령 조문 |
| `query_applicability` | 대상물 조건 → 적용 의무 판정 |
| `list_duties_by_cycle` | 주기별(연/수시 등) 법정문서 색인 |

### 4.3 문서 합성·검토
| 도구 | 역할 |
|------|------|
| `map_defect_to_remediation` | 지적사항(불량) → 근거 조문 + 벌칙 + 조치안 |
| `generate_inspection_report` | 점검 데이터 → 자체점검 결과보고서 초안(MD/JSON-LD) |
| `review_inspection_report` | 작성된 보고서 → 누락·오류 검수 |

### 4.4 법령 본문 조회
| 도구 | 역할 |
|------|------|
| `search_fire_law` | 키워드로 소방법령 번들 검색 |
| `get_fire_law_article` | 조문 본문 반환 |
| `get_nftc_standard` | NFPC/NFTC 기술기준 조회 |

## 5. 데이터 번들 전략

잘 안 바뀌는 법령·기준은 **오프라인 번들(JSON/MD)로 서버에 내장.** 네트워크·API키 없이 ms 단위 조회.

| 데이터 | 출처 | 비고 |
|--------|------|------|
| 소방시설법·화재예방법·소방기본법 본문 | 법제처 law.go.kr Open API | 조→항→호→목 단위 청킹 + 메타데이터(법령명·조문번호·시행일) |
| NFPC/NFTC 기술기준 | nfsc.go.kr | 법제처 미등재 → 별도 수집 (핵심 과제) |
| 자체점검사항 고시 | 소방시설법령집 p.503~ | 지적사항 매핑의 근거 |

> 메타데이터에 시행일을 부착해 **점검일 기준 효력 법령**을 적용할 수 있게 설계.

## 6. 개발 단계 로드맵

```
1. 데이터 정제   소방법·NFTC·자체점검고시 → JSON/MD 로컬 번들
2. 스키마 정의   Tools 인터페이스(JSON Schema) 설계
3. TS 구현       @modelcontextprotocol/sdk로 서버 + 결정론적 룰
4. 디버깅        npx @modelcontextprotocol/inspector 로 도구 실측
5. 호스트 연동   Claude Desktop config.json 연결 검증
```

### 도구 정의·로직 예시
```typescript
// 정의
{
  name: "assess_building_fire_obligations",
  description: "건물 용도·연면적·층수를 받아 소방안전관리등급과 필수 소방시설을 계산",
  inputSchema: {
    type: "object",
    properties: {
      buildingType: { type: "string", description: "apartment | building | arcade" },
      totalArea:    { type: "number", description: "연면적(㎡)" },
      floors:       { type: "number", description: "층수" }
    },
    required: ["buildingType", "totalArea"]
  }
}

// 로직 (결정론적 — 실제 등급 기준은 소방시설법 시행령에 맞춰 확정 필요)
async function handle(args) {
  let grade = "3급";
  if (args.totalArea >= 15000) grade = "1급";
  else if (args.totalArea >= 5000) grade = "2급";
  return { content: [{ type: "text",
    text: `등급 [${grade}] · 매년 1회 작동점검 의무` }] };
}
```
> ⚠️ 위 임계값은 예시. 실제 등급 기준은 reference/ 법령집과 소방시설법 시행령으로 검증 후 확정.
