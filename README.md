# ApolloDatabase 阿波罗文档搜索平台

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Orama-3-blue?style=flat-square" alt="Orama" />
  <img src="https://img.shields.io/badge/Cloudflare_Pages-orange?style=flat-square&logo=cloudflare" alt="Cloudflare Pages" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License: MIT" />
</div>

## 项目简介

ApolloDatabase 是一个全文搜索平台，专为百度 Apollo 自动驾驶文档设计。**完全部署在 Cloudflare Pages 边缘网络**，无需后端服务器。

搜索引擎使用 [Orama](https://github.com/orama-ai/orama) 在浏览器端运行，搜索索引随静态站一起部署，首次加载约 800KB (gzip)。

## 架构

```
┌─────────────────────────────────────────────┐
│           Cloudflare Pages (全球边缘)         │
│                                             │
│  静态 HTML/JS (Next.js export)              │
│  + /search-index/articles.json (~800KB gz)  │
│                                             │
│  浏览器加载索引 → Orama 本地全文搜索          │
└─────────────────────────────────────────────┘

爬虫 (离线) → Meilisearch dump → build-index → 静态索引
```

- **零后端成本**：纯静态站，CF Pages 免费版完全够用
- **边缘加速**：全球 CDN 分发，搜索响应 < 10ms (本地计算)
- **隐私友好**：搜索请求不离开用户浏览器

## 快速开始

```bash
# 安装依赖
yarn install

# 构建搜索索引 + 静态站
yarn build

# 本地预览
npx serve out
```

## 部署到 Cloudflare Pages

### 方式一：Wrangler CLI

```bash
npx wrangler pages deploy out --project-name=apollo-database
```

### 方式二：GitHub 集成

1. Fork 本仓库
2. 在 Cloudflare Dashboard → Pages → Create project → Connect to Git
3. 设置：
   - Build command: `yarn build`
   - Build output directory: `out`
   - Node.js version: 20+

## 数据更新

爬虫仍然需要本地运行（依赖 Puppeteer/Meilisearch），但**不影响线上部署**：

```bash
# 爬取新文章 (需要本地 Meilisearch 运行)
yarn spider:new

# 导出新的 dump → 放到 data/ → 重新构建
yarn build:index
```

更新索引后重新部署即可。

## 项目结构

```
ApolloDatabase/
├── src/
│   ├── app/              # Next.js 页面 (静态导出)
│   ├── components/       # React 组件
│   ├── lib/
│   │   ├── search.ts     # Orama 客户端搜索
│   │   └── types.ts      # 类型定义
│   └── spider/           # 爬虫 (离线使用)
├── scripts/
│   └── build-index.ts    # 从 Meilisearch dump 构建 Orama 索引
├── data/
│   └── *.dump            # Meilisearch 数据导出
├── public/
│   └── search-index/     # 构建生成的搜索索引 (gitignore)
├── out/                  # 静态站输出 (gitignore)
├── wrangler.json         # CF Pages 配置
└── package.json
```

## 许可证

MIT

## 作者

Steven Moder - java20131114@gmail.com
