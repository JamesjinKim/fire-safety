import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "소방안전점검",
  description:
    "9대 의무 다 안 합니다. 자체점검 일지·보고서만은 한국에서 가장 정확하고 가장 가볍게.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
