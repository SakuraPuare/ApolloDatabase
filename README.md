# ApolloDatabase 阿波罗文档搜索平台

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-15.3.1-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.1.0-blue?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.4.5-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.1.4-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Meilisearch-0.50.0-ff69b4?style=flat-square" alt="Meilisearch" />
  <img src="https://img.shields.io/badge/Shadcn_UI-latest-8A2BE2?style=flat-square" alt="Shadcn UI" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License: MIT" />
</div>

## 📝 项目简介

ApolloDatabase 是一个高性能的文档搜索平台，专为百度 Apollo（自动驾驶开放平台）官方文档设计。该平台采用现代化的前端技术栈和高效的搜索引擎，通过智能爬虫自动获取并索引 Apollo 官网的技术文档内容，为开发者和用户提供快速、准确的全文搜索服务，大幅提升信息检索效率。

## ✨ 主要功能

- **高性能全文搜索**：基于 Meilisearch 搜索引擎，支持模糊匹配、拼写纠错和多语言搜索
- **关键词智能高亮**：搜索结果中自动高亮显示匹配关键词，提升阅读体验
- **自动内容爬取**：定期自动爬取百度 Apollo 官网最新文章，保持内容时效性
- **增量更新机制**：智能检测并仅爬取新增或更新的内容，减少系统资源占用
- **响应式现代界面**：基于 React 19、Next.js 15 和 Tailwind CSS 4 构建的美观响应式界面
- **服务端渲染优化**：采用 Next.js App Router 架构，提供更好的性能和 SEO 支持
- **高级搜索选项**：支持按文档类别、时间范围和相关度排序等高级筛选
- **分页与排序功能**：智能分页算法和多种排序方式，优化大量结果的浏览体验
- **移动端友好设计**：完全适配移动设备，提供流畅的移动搜索体验

## 🔧 技术栈

### 前端
- **框架**: React 19, Next.js 15 (App Router)
- **UI组件**: Shadcn UI, Radix UI
- **样式**: Tailwind CSS 4
- **状态管理**: React Hooks + Context API
- **类型系统**: TypeScript 5.4.5

### 后端
- **API服务**: Next.js API Routes
- **搜索引擎**: Meilisearch 0.50.0
- **爬虫工具**: Axios, Cheerio
- **数据处理**: Node.js Streams

### 开发与部署
- **开发语言**: TypeScript
- **构建工具**: Turbopack
- **部署环境**: Vercel / Docker

## 🚀 快速开始

### 前提条件

- Node.js (v18.0.0+)
- Yarn 包管理器
- Docker (用于运行 Meilisearch)

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/SakuraPuare/ApolloDatabase.git
cd ApolloDatabase
```

2. **安装依赖**

```bash
yarn install
```

3. **环境配置**

复制示例环境配置文件并根据需要修改：

```bash
cp .env.example .env.development
```

4. **启动 Meilisearch**

使用 Docker 运行 Meilisearch：

```bash
docker run -p 7700:7700 -v $(pwd)/meili_data:/meili_data getmeili/meilisearch:v1.5
```

5. **初始爬取数据**

```bash
yarn spider:new
```

6. **启动开发服务器**

```bash
yarn dev
```

现在，你可以在浏览器中访问 `http://localhost:3000` 查看应用。

7. **构建生产版本**

```bash
yarn build
yarn start
```

## 🔄 数据更新

### 增量更新现有数据

```bash
yarn spider:update
```

### 设置定时任务

可以通过 cron 作业设置定期运行爬虫脚本，例如：

```bash
# 每天凌晨2点运行更新爬虫
0 2 * * * cd /path/to/ApolloDatabase && yarn spider:update
```

## 💡 项目结构

```
ApolloDatabase/
├── src/                  # 源代码目录
│   ├── app/              # Next.js App Router 页面
│   │   └── search/       # 搜索相关组件
│   ├── components/       # React 组件
│   │   └── search/       # 搜索相关组件
│   ├── lib/              # 核心库和工具函数
│   ├── services/         # 服务层，处理业务逻辑
│   ├── spider/           # 爬虫相关代码
│   └── utils/            # 通用工具函数
├── data/                 # 存储爬取的数据
│   └── apollo-docs/      # Apollo文档数据
├── .env.development      # 开发环境配置
├── .env.production       # 生产环境配置
└── next.config.ts        # Next.js 配置
```

## 🔍 使用说明

1. 访问首页，在搜索框中输入关键词
2. 点击搜索按钮或按 Enter 键开始搜索
3. 浏览搜索结果，点击文章标题查看完整内容
4. 使用筛选选项优化搜索结果
5. 使用分页控件浏览更多结果

## 🛠 配置选项

主要配置选项位于环境文件中（`.env.development` 或 `.env.production`）：

- `MEILISEARCH_HOST`: Meilisearch 服务器地址
- `MEILISEARCH_API_KEY`: Meilisearch API 密钥
- `APOLLO_BASE_URL`: Apollo 官网基础URL
- `CRAWL_INTERVAL`: 爬虫运行间隔（毫秒）
- `MAX_CONCURRENT_REQUESTS`: 最大并发请求数

## 📄 许可证

本项目基于 MIT 许可证开源 - 详见 [LICENSE](LICENSE) 文件

## 👨‍💻 作者

Steven Moder - java20131114@gmail.com

## 🙏 鸣谢

- [百度 Apollo 自动驾驶开放平台](https://apollo.baidu.com/) - 提供优质的自动驾驶技术文档
- [Meilisearch](https://www.meilisearch.com/) - 提供出色的搜索引擎技术
- [Next.js](https://nextjs.org/) - 提供强大的 React 框架
- [Tailwind CSS](https://tailwindcss.com/) - 提供优秀的 CSS 框架
- [Shadcn UI](https://ui.shadcn.com/) - 提供高质量的UI组件库

## 📊 路线图

- [ ] 添加用户认证系统
- [ ] 实现个性化搜索偏好保存
- [ ] 支持文档评论和标注
- [ ] 添加更多数据源支持
- [ ] 实现文档内容差异对比功能

---

<div align="center">
  <small>🚀 如有任何问题或建议，欢迎提交 Issue 或 Pull Request</small>
</div> 