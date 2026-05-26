// 인쇄 전용 라우트 layout
// ⚠️ globals.css 미포함 — print.css만 로드해서 §6A 화면 톤(그린 액센트 등) 비적용
// Design v0.2.2 §6 인쇄 표준 (A4 210×297mm 1:1, 흑백 단색)
import "../../styles/print.css";

export default function PrintLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
