# Database: fire-inspection-system 저장소 및 테이블 기준선

> PDCA Design 보강 문서 · feature: `fire-inspection-system`
> 작성일 **2026-05-26**
> 원본 Design: [fire-inspection-system.design.md](./fire-inspection-system.design.md)

---

## 1. 결정

v1 구현은 기존 결정대로 **로컬 JSON + 로컬 파일시스템**으로 시작한다. 다만 Phase 04(`packages/types`) 진입 전에 운영 DB 기준선을 아래처럼 확정한다.

| 항목 | 결정 |
|---|---|
| 운영 DB 후보 | **PostgreSQL 호환 RDB** |
| 1차 관리형 후보 | Supabase Postgres Seoul(`ap-northeast-2`) 또는 동일한 PostgreSQL 계열 |
| 스키마 전략 | 핵심 관계는 정규화, 동결 스냅샷·OCR 원문·출력 view-model은 `jsonb` |
| 멀티테넌시 | 모든 업무 테이블에 `org_id` 포함 |
| 파일 저장 | DB에는 `attachments` 메타만 저장, 실제 파일은 v1 `data/projects/.../attachments/`, 운영 전환 시 Supabase Storage Seoul |
| 법정 마스터 데이터 | v1은 JSON SSoT 유지. 운영 DB로 옮겨도 `fire-duty-master`와 `inspection-checklist`는 import 대상 마스터 테이블로 분리 |

PostgreSQL을 기준으로 잡는 이유는 이 도메인이 고객사·건물·프로젝트·점검결과처럼 관계형 질의가 많고, 동시에 `WorkOrder`, `BuildingRegisterExtraction`, 법령 스냅샷처럼 변경 불가 JSON 스냅샷을 안전하게 보관해야 하기 때문이다.

## 2. v1 로컬 JSON과 DB 테이블 매핑

| v1 파일 | 운영 DB 테이블 |
|---|---|
| `project.json` | `inspection_projects` |
| `register.json` | `building_registers` |
| `suggestions.json` | `suggested_facility_sections` |
| `work-order.json` | `work_orders` |
| `inspection.json` | `inspections`, `inspection_sections`, `inspection_results`, `field_notes` |
| `discrepancies.jsonl` | `discrepancies` |
| `billing.json` | `billing_documents`, `billing_line_items` |
| `attachments/**` | `attachments` + Object Storage |

## 3. 핵심 테이블

### 3.1 조직·사용자

| 테이블 | 주요 컬럼 |
|---|---|
| `organizations` | `id`, `name`, `business_registration_number`, `representative_name`, `contact_phone`, `contact_email`, `created_at` |
| `users` | `id`, `org_id`, `email`, `name`, `role`, `certifications_json`, `active`, `created_at` |

`users.org_id`는 `organizations.id`를 참조한다. `role`은 v1에서 `admin`, `field`만 허용한다.

### 3.2 고객사·건물·프로젝트

| 테이블 | 주요 컬럼 |
|---|---|
| `customer_companies` | `id`, `org_id`, `name`, `business_registration_number`, `representative_name`, `contact_phone`, `address`, `notes`, `created_at` |
| `buildings` | `id`, `org_id`, `customer_company_id`, `name`, `address`, `created_at` |
| `inspection_projects` | `id`, `org_id`, `customer_company_id`, `building_id`, `title`, `inspection_type`, `status`, `created_by`, `created_at`, `updated_at` |

인덱스:
- `customer_companies(org_id, name)`
- `buildings(org_id, customer_company_id)`
- `inspection_projects(org_id, status, created_at desc)`

### 3.3 건축물대장·OCR

| 테이블 | 주요 컬럼 |
|---|---|
| `building_registers` | `id`, `org_id`, `project_id`, `source_file_id`, `extraction_json`, `confirmation_status`, `confirmed_building_meta_json`, `confirmed_by`, `confirmed_at`, `created_at` |

`extraction_json`은 `BuildingRegisterExtraction`, `confirmed_building_meta_json`은 `BuildingMeta`를 저장한다. 설비 추천은 `confirmation_status = 'confirmed'`인 행의 `confirmed_building_meta_json`만 사용한다.

### 3.4 추천·작업지시

| 테이블 | 주요 컬럼 |
|---|---|
| `suggested_facility_sections` | `id`, `org_id`, `project_id`, `facility_code`, `facility_name`, `category`, `reason`, `legal_basis_json`, `confidence`, `review_status`, `reviewed_by`, `reviewed_at`, `review_note` |
| `work_orders` | `id`, `org_id`, `project_id`, `issued_at`, `issued_by`, `building_meta_snapshot_json`, `applicable_law_snapshot_json`, `applied_facilities_json`, `checklist_outline_json`, `reasoning`, `hash` |

`work_orders`는 동결 객체이므로 update를 금지하고 필요 시 새 work order를 발행한다. `hash`에는 unique index를 둔다.

### 3.5 현장 점검

| 테이블 | 주요 컬럼 |
|---|---|
| `inspections` | `id`, `org_id`, `project_id`, `work_order_id`, `type`, `period_start`, `period_end`, `status`, `started_at`, `submitted_at` |
| `inspection_sections` | `id`, `org_id`, `inspection_id`, `facility_code`, `facility_name`, `checklist_form_code`, `assigned_user_ids_json`, `status`, `last_edited_by`, `last_edited_at`, `lock_holder` |
| `inspection_results` | `id`, `org_id`, `section_id`, `checklist_item_code`, `result`, `defect_description`, `action_required`, `attachment_ids_json`, `updated_by`, `updated_at` |
| `field_notes` | `id`, `org_id`, `project_id`, `inspection_id`, `section_id`, `checklist_item_code`, `type`, `title`, `memo`, `attachment_ids_json`, `created_by`, `created_at` |
| `discrepancies` | `id`, `org_id`, `inspection_id`, `occurred_at`, `who`, `field_path`, `before_json`, `after_json`, `reason`, `evidence_json` |

`discrepancies`는 append-only다. 삭제나 수정은 v1 정책상 금지한다.

### 3.6 첨부·비용

| 테이블 | 주요 컬럼 |
|---|---|
| `attachments` | `id`, `org_id`, `project_id`, `kind`, `storage_key`, `file_name`, `mime_type`, `size_bytes`, `checksum`, `created_by`, `created_at` |
| `billing_documents` | `id`, `org_id`, `project_id`, `customer_company_id`, `status`, `billing_type`, `supplier_json`, `recipient_json`, `subtotal_amount`, `tax_amount`, `total_amount`, `memo`, `pdf_file_id`, `created_by`, `created_at`, `issued_at` |
| `billing_line_items` | `id`, `org_id`, `billing_document_id`, `name`, `spec`, `quantity`, `unit_price`, `supply_amount`, `tax_amount`, `note`, `sort_order` |

## 4. 마스터 데이터 테이블 후보

초기에는 `packages/fire-data`가 JSON을 로드한다. 운영 DB 전환 시 아래 테이블로 import할 수 있게 JSON 키를 안정적으로 유지한다.

| 마스터 | 운영 DB 후보 |
|---|---|
| `data/fire-duty-master.json` | `fire_duty_documents`, `fire_duty_nodes` |
| `data/inspection-checklist.json` | `checklist_forms`, `checklist_items` |
| `data/law-snapshots/*.json` | `law_snapshots` |

## 5. Phase 03 종료 기준과 Phase 04 연결

Phase 03에서는 최소한 다음 산출물을 확정한다.

1. `docs/02-design/features/fire-inspection-system.database.md`
2. v1 JSON 파일과 운영 DB 테이블 매핑표
3. 핵심 테이블 목록과 `org_id` 적용 범위
4. `jsonb`로 둘 스냅샷 경계

Phase 04(`packages/types`)에서는 이 기준선을 바탕으로 `domain.ts`, `transitions.ts`, `database.ts` 또는 `storage.ts`를 작성한다. `database.ts`는 실제 DB 클라이언트가 아니라, 테이블 row 타입과 domain 타입 간 매핑 정책을 고정하는 파일로 시작한다.
