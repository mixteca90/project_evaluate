import type { Metadata } from "next";
import "./globals.css";

// Supabase DB가 시드니(ap-southeast-2)에 있어, 서버리스 함수도 같은 리전에서 실행되어야 한다.
// 실제 리전 고정은 Vercel 프로젝트 설정(serverlessFunctionRegion=syd1)으로 적용되어 있으며,
// 아래 preferredRegion은 의도를 코드에 남기기 위한 선언이다. 설정을 바꾸면 DB 왕복마다
// 태평양을 건너게 되어 결과 페이지가 수 배 느려지므로 임의로 변경하지 말 것.
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
