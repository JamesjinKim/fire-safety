export default function PrintIndex() {
  return (
    <div style={{ padding: "20mm", fontFamily: "inherit" }}>
      <h1 style={{ margin: 0, fontSize: "14pt" }}>인쇄 라우트 placeholder</h1>
      <p style={{ marginTop: "8mm", fontSize: "10.5pt", lineHeight: 1.4 }}>
        Phase 12+에서 다음 경로가 실제 별지 컴포넌트로 교체됩니다:
      </p>
      <ul style={{ marginTop: "4mm", fontSize: "10.5pt", lineHeight: 1.6, paddingLeft: "8mm" }}>
        <li><code>/print/form9/[inspectionId]</code> — 별지 제9호서식 (자체점검 결과보고서)</li>
        <li><code>/print/form4/[inspectionId]</code> — 별지 제4호서식 (점검표 7종)</li>
        <li><code>/print/billing/[billingId]</code> — 세금계산서 형태 PDF</li>
      </ul>
      <p style={{ marginTop: "8mm", fontSize: "9pt", color: "#666" }}>
        이 라우트는 <code>globals.css</code>를 로드하지 않습니다 — 그린 액센트 등 화면 톤이 인쇄물에 들어가지 않도록 분리되어 있습니다.
      </p>
    </div>
  );
}
