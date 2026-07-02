import type { Metadata } from "next";
import "./globals.css";

// Supabase DB가 시드니(ap-southeast-2)에 있어, 서버리스 함수도 같은 리전에서 실행되도록 고정
// (기본 리전인 미국 동부에서 실행되면 DB 왕복마다 태평양을 두 번 건너 매우 느려짐)
export const preferredRegion = "syd1";

export const metadata: Metadata = {
  title: "조별 프로젝트 평가",
  description: "조별 프로젝트 상호평가 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900" style={{ fontFamily: "Pretendard, system-ui, sans-serif" }}>
        <div className="mx-auto w-full max-w-md min-h-screen bg-slate-50 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
