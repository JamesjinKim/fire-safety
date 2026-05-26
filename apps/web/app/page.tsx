import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "var(--huge) var(--xl)",
      }}
    >
      <h1 className="t-display-lg" style={{ margin: 0 }}>
        소방안전점검
      </h1>
      <p
        className="t-body-lg muted"
        style={{ marginTop: "var(--sm)", maxWidth: 560 }}
      >
        9대 의무 다 안 합니다. 자체점검 일지·보고서만은 한국에서 가장 정확하고
        가장 가볍게.
      </p>

      <div
        style={{
          marginTop: "var(--xxl)",
          padding: "var(--xl)",
          background: "var(--canvas)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-lg)",
        }}
      >
        <p className="t-caption muted" style={{ margin: 0 }}>
          Phase 1+2 부트스트랩 완료. 다음 단계는 Phase 3 — 도메인 타입 코드화.
        </p>
        <Link
          href="/design-check"
          style={{
            display: "inline-block",
            marginTop: "var(--lg)",
            color: "var(--primary)",
            fontWeight: 500,
            fontSize: "var(--t-body-size)",
          }}
        >
          → 디자인 시스템 토큰 검증 페이지
        </Link>
      </div>
    </main>
  );
}
