# ApolloDatabase 阿波罗文档搜索平台

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-15.3.1-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.1.0-blue?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.4.5-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.1.4-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Meilisearch-0.50.0-ff69b4?style=flat-square" alt="Meilisearch" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License: MIT" />
</div>

## 📝 项目简介

ApolloDatabase 是一个专为百度 Apollo（自动驾驶开放平台）官方文档设计的搜索平台。该平台通过爬虫自动获取并索引 Apollo 官网的文章内容，并提供高效、智能的全文搜索功能，帮助开发者和用户快速找到所需的 Apollo 相关技术文档和信息。

## ✨ 主要功能

- **强大的搜索功能**：基于 Meilisearch 的全文搜索，支持关键词高亮显示
- **自动内容爬取**：定期自动爬取百度 Apollo 官网最新文章
- **增量更新**：智能检测并仅爬取新增或更新的内容
- **美观的用户界面**：基于 React 和 Tailwind CSS 的现代化响应式界面
- **服务端渲染**：基于 Next.js App Router 的服务端渲染，提供更好的性能和 SEO
- **分页浏览**：支持搜索结果分页查看

## 🔧 技术栈

- **前端**：React 19, Next.js 15 (App Router), Tailwind CSS 4
- **后端**：Next.js API Routes
- **搜索引擎**：Meilisearch
- **爬虫工具**：Axios, Cheerio
- **开发语言**：TypeScript

## 🚀 快速开始

### 前提条件

- Node.js (v18.0.0+)
- Yarn 包管理器
- Docker (用于运行 Meilisearch，可选)

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
cp .env.example .env.local
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

## 🔍 使用说明

1. 访问首页，在搜索框中输入关键词
2. 点击搜索按钮或按 Enter 键开始搜索
3. 浏览搜索结果，点击文章标题查看完整内容
4. 使用分页控件浏览更多结果

## 📄 许可证

本项目基于 MIT 许可证开源 - 详见 [LICENSE](LICENSE) 文件

## 👨‍💻 作者

Steven Moder - java20131114@gmail.com

## 🙏 鸣谢

- [百度 Apollo 自动驾驶开放平台](https://apollo.baidu.com/) - 提供优质的自动驾驶技术文档
- [Meilisearch](https://www.meilisearch.com/) - 提供出色的搜索引擎技术
- [Next.js](https://nextjs.org/) - 提供强大的 React 框架
- [Tailwind CSS](https://tailwindcss.com/) - 提供优秀的 CSS 框架

---

<div align="center">
  <small>🚀 如有任何问题或建议，欢迎提交 Issue 或 Pull Request</small>
</div> 