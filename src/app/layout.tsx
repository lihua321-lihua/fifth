import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "小步辅导",
  description: "初中英语 AI 作业辅导 + 错题本",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <div className="phone-stage">
          <div className="phone-frame">
            {/* 手机系统状态栏（模拟） */}
            <div className="phone-statusbar">
              <span className="statusbar-time">9:41</span>
              <div className="flex items-center gap-1.5">
                <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden="true">
                  <rect x="0" y="8" width="3" height="3" rx="1" />
                  <rect x="4.5" y="6" width="3" height="5" rx="1" />
                  <rect x="9" y="3.5" width="3" height="7.5" rx="1" />
                  <rect x="13.5" y="0" width="3" height="11" rx="1" />
                </svg>
                <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor" aria-hidden="true">
                  <path d="M8 8.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM8 5.1a4.9 4.9 0 0 0-4.9 4.9h1.4A3.5 3.5 0 0 1 8 6.5a3.5 3.5 0 0 1 3.5 3.5h1.4A4.9 4.9 0 0 0 8 5.1zM8 2a8 8 0 0 0-8 8h1.6a6.4 6.4 0 0 1 12.8 0H16a8 8 0 0 0-8-8z" />
                </svg>
                <svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden="true">
                  <rect x="0.6" y="0.6" width="21" height="10.8" rx="3" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="2.5" y="2.5" width="15" height="7" rx="1.6" fill="currentColor" />
                  <rect x="23" y="4" width="2" height="4" rx="1" fill="currentColor" />
                </svg>
              </div>
            </div>
            <div className="phone-scroll">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}