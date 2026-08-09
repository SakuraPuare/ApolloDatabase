import "./index.css";
import React from "react";

export const metadata = {
  title: "Apollo 数据库 | 百度 Apollo 自动驾驶文档搜索",
  description:
    "搜索百度 Apollo 官网的文章内容，获取自动驾驶技术的最新资讯。边缘部署，即时搜索。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem('theme');if(t==='dark'||((!t)&&window.matchMedia('(prefers-color-scheme:dark)').matches)){d.classList.add('dark')}else{d.classList.remove('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
