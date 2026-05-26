// 디자인 시스템 토큰 검증 페이지
// Design v0.2.2 §6A 토큰이 시안(docs/design-preview/supabase-tone.html)과 1:1 일치하는지 확인
// Phase 1+2 완료 검증용. Phase 8+에서 실제 화면 구현 시 본 페이지 삭제 또는 유지.

export default function DesignCheckPage() {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "var(--huge) var(--xl)",
      }}
    >
      <header style={{ marginBottom: "var(--xxl)" }}>
        <h1 className="t-display-lg" style={{ margin: 0 }}>
          디자인 시스템 검증
        </h1>
        <p
          className="t-body-lg muted"
          style={{ marginTop: "var(--sm)", maxWidth: 560 }}
        >
          Design v0.2.2 §6A 토큰 동작 확인. 시안{" "}
          <code className="t-mono t-caption">
            docs/design-preview/supabase-tone.html
          </code>
          과 색상·폰트·간격이 일치해야 함.
        </p>
      </header>

      {/* ─── 1. Color swatches ─── */}
      <Section label="01" title="컬러 토큰">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--md)" }}>
          <Swatch token="--primary" value="#2F9E44" label="primary" textOn="#fff" />
          <Swatch token="--primary-deep" value="#237A35" label="primary-deep" textOn="#fff" />
          <Swatch token="--primary-soft" value="#e6f3e7" label="primary-soft" textOn="#1a5a25" />
          <Swatch token="--ink" value="#171717" label="ink" textOn="#fff" />
          <Swatch token="--ink-mute" value="#707070" label="ink-mute" textOn="#fff" />
          <Swatch token="--canvas" value="#ffffff" label="canvas" textOn="#171717" border />
          <Swatch token="--canvas-soft" value="#fafafa" label="canvas-soft" textOn="#171717" border />
          <Swatch token="--hairline" value="#dfdfdf" label="hairline" textOn="#171717" border />
          <Swatch token="--fail" value="#e02d3c" label="fail" textOn="#fff" />
          <Swatch token="--not-checked" value="#f5a623" label="not-checked" textOn="#fff" />
          <Swatch token="--edited" value="#3340a9" label="edited (OCR)" textOn="#fff" />
          <Swatch token="--low-confidence" value="#92560c" label="low-confidence" textOn="#fff" />
        </div>
      </Section>

      {/* ─── 2. Typography ─── */}
      <Section label="02" title="타이포그래피">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--md)" }}>
          <p className="t-display-lg" style={{ margin: 0 }}>display-lg · 36 · 500 · 한글 가나다 ABC123</p>
          <p className="t-display-md" style={{ margin: 0 }}>display-md · 28 · 500 · 한글 가나다 ABC123</p>
          <p className="t-heading-lg" style={{ margin: 0 }}>heading-lg · 22 · 500 · 한글 가나다 ABC123</p>
          <p className="t-heading-md" style={{ margin: 0 }}>heading-md · 18 · 500 · 한글 가나다 ABC123</p>
          <p className="t-body-lg" style={{ margin: 0 }}>body-lg · 17 · 400 · 한글 가나다 ABC123 (도입부 설명용, ink-mute와 조합 권장)</p>
          <p className="t-body" style={{ margin: 0 }}>body · 15 · 400 · 한글 가나다 ABC123 (본문 기본)</p>
          <p className="t-caption muted" style={{ margin: 0 }}>caption · 13 · 400 · 한글 가나다 ABC123</p>
          <p className="t-micro muted" style={{ margin: 0, letterSpacing: "0.2px" }}>MICRO · 12 · 400 · 뱃지·라벨용</p>
          <p className="t-mono t-caption" style={{ margin: 0 }}>
            JetBrains Mono · 1-A-007 · WO #a4f3·8b2 ·{" "}
            <span className="t-tabnum">1,320,000원</span> · 측정값{" "}
            <span className="t-tabnum">0.21 MPa / 142 L/min</span>
          </p>
        </div>
      </Section>

      {/* ─── 3. Buttons ─── */}
      <Section label="03" title="버튼">
        <div style={{ display: "flex", gap: "var(--md)", flexWrap: "wrap", alignItems: "center" }}>
          <button style={btnStyle("primary")}>+ 새 프로젝트</button>
          <button style={btnStyle("outline")}>초안 저장</button>
          <button style={btnStyle("ghost")}>취소</button>
          <button style={btnStyle("primary", "sm")}>검수 완료</button>
          <button style={btnStyle("outline", "sm")}>불일치 기록</button>
        </div>
      </Section>

      {/* ─── 4. Card & Pills ─── */}
      <Section label="04" title="카드 + Pill 뱃지">
        <div
          style={{
            background: "var(--canvas)",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-lg)",
            padding: "var(--xl)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 className="t-heading-md" style={{ margin: "0 0 var(--xs)" }}>○○빌딩 2026 자체점검</h3>
              <p className="t-caption muted" style={{ margin: 0 }}>
                세종건설(주) · 사용승인{" "}
                <span className="t-tabnum">2010-08-15</span> · 연면적{" "}
                <span className="t-tabnum">5,420㎡</span>
              </p>
            </div>
            <Pill variant="warn">● OCR 검수 중</Pill>
          </div>

          <div style={{ display: "flex", gap: "var(--sm)", marginTop: "var(--lg)", flexWrap: "wrap" }}>
            <Pill variant="green">● 작업지시 동결</Pill>
            <Pill variant="fail">● 불량 8건</Pill>
            <Pill variant="mute">● 초안</Pill>
            <Pill variant="default">● 진행 중</Pill>
          </div>
        </div>
      </Section>

      {/* ─── 5. OCR 검수 뱃지 5종 ─── */}
      <Section label="05" title="OCR 검수 뱃지 5종">
        <div style={{ display: "flex", gap: "var(--sm)", flexWrap: "wrap" }}>
          <OcrBadge bg="var(--canvas-soft)" fg="var(--ink-mute)" border>● 추출됨 · 신뢰도 0.92</OcrBadge>
          <OcrBadge bg="var(--primary-soft)" fg="#1a5a25">● 확정</OcrBadge>
          <OcrBadge bg="#eef0ff" fg="#3340a9">✎ 수정됨</OcrBadge>
          <OcrBadge bg="#fef4e0" fg="#92560c">! 신뢰도 낮음</OcrBadge>
          <OcrBadge bg="var(--fail-soft)" fg="#8a1320">⚠ 누락</OcrBadge>
        </div>
      </Section>

      {/* ─── 6. 결과 토글 (점검 결과 4-way) ─── */}
      <Section label="06" title="점검 결과 토글">
        <div
          style={{
            display: "inline-flex",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-sm)",
            overflow: "hidden",
            background: "var(--canvas-soft)",
          }}
        >
          <ResultBtn variant="pass" active>적합</ResultBtn>
          <ResultBtn variant="fail">부적합</ResultBtn>
          <ResultBtn variant="na">해당없음</ResultBtn>
          <ResultBtn variant="nc">미점검</ResultBtn>
        </div>
        <p className="t-caption muted" style={{ marginTop: "var(--md)" }}>
          위 토글에서 "적합"이 활성화된 상태(--primary 배경 + 흰 글자)가 시안과 일치해야 합니다.
        </p>
      </Section>

      <footer style={{ marginTop: "var(--huge)", paddingTop: "var(--xl)", borderTop: "1px solid var(--hairline)" }}>
        <p className="t-caption muted" style={{ margin: 0 }}>
          ✅ 위 6개 섹션이 모두 시안과 일치하면 Phase 2 종료. 다음은 Phase 3 — packages/types 도메인 타입 코드화.
        </p>
      </footer>
    </main>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function Section({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--xxl)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--md)", marginBottom: "var(--md)" }}>
        <span
          className="t-mono"
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "1.4px",
            color: "var(--ink-mute)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <h2 className="t-heading-lg" style={{ margin: 0 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Swatch({
  token,
  value,
  label,
  textOn,
  border,
}: {
  token: string;
  value: string;
  label: string;
  textOn: string;
  border?: boolean;
}) {
  return (
    <div
      style={{
        background: `var(${token})`,
        color: textOn,
        padding: "var(--md)",
        borderRadius: "var(--r-md)",
        border: border ? "1px solid var(--hairline)" : "none",
        minHeight: 64,
      }}
    >
      <div className="t-body-sm" style={{ fontWeight: 500 }}>{label}</div>
      <div className="t-mono" style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function btnStyle(variant: "primary" | "outline" | "ghost", size: "md" | "sm" = "md") {
  const base = {
    fontFamily: "inherit",
    fontWeight: 500,
    border: "1px solid transparent",
    borderRadius: "var(--r-sm)",
    cursor: "pointer",
    lineHeight: 1,
    fontSize: size === "sm" ? 13 : 14,
    padding: size === "sm" ? "6px 12px" : "8px 16px",
  } as const;
  if (variant === "primary") return { ...base, background: "var(--primary)", color: "#fff" };
  if (variant === "outline")
    return { ...base, background: "var(--canvas)", color: "var(--ink)", borderColor: "var(--hairline-strong)" };
  return { ...base, background: "transparent", color: "var(--ink)" };
}

type PillVariant = "default" | "green" | "warn" | "fail" | "mute";
const PILL_STYLES: Record<PillVariant, { bg: string; fg: string; border: string }> = {
  default: { bg: "var(--canvas)", fg: "var(--ink-2)", border: "var(--hairline)" },
  green:   { bg: "var(--primary-soft)", fg: "#1a5a25", border: "transparent" },
  warn:    { bg: "#fef4e0", fg: "#92560c", border: "transparent" },
  fail:    { bg: "var(--fail-soft)", fg: "#8a1320", border: "transparent" },
  mute:    { bg: "var(--canvas-soft)", fg: "var(--ink-mute)", border: "transparent" },
};

function Pill({ variant, children }: { variant: PillVariant; children: React.ReactNode }) {
  const s = PILL_STYLES[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1,
        padding: "4px 10px",
        borderRadius: 9999,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
      }}
    >
      {children}
    </span>
  );
}

function OcrBadge({ bg, fg, border, children }: { bg: string; fg: string; border?: boolean; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1,
        padding: "3px 8px",
        borderRadius: "var(--r-xs)",
        background: bg,
        color: fg,
        border: border ? "1px solid var(--hairline)" : "none",
      }}
    >
      {children}
    </span>
  );
}

type ResultVariant = "pass" | "fail" | "na" | "nc";
const RESULT_PALETTE: Record<ResultVariant, { bg: string; fg: string }> = {
  pass: { bg: "var(--primary)", fg: "#fff" },
  fail: { bg: "var(--fail)", fg: "#fff" },
  na:   { bg: "var(--ink)", fg: "#fff" },
  nc:   { bg: "var(--not-checked)", fg: "#fff" },
};

function ResultBtn({
  variant,
  active,
  children,
}: {
  variant: ResultVariant;
  active?: boolean;
  children: React.ReactNode;
}) {
  const p = RESULT_PALETTE[variant];
  return (
    <button
      style={{
        fontFamily: "inherit",
        fontSize: 12.5,
        fontWeight: 500,
        border: 0,
        borderRight: "1px solid var(--hairline)",
        background: active ? p.bg : "transparent",
        color: active ? p.fg : "var(--ink-mute)",
        padding: "6px 12px",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
