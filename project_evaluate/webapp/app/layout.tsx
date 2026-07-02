import type { Metadata } from "next";
import "./globals.css";

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
