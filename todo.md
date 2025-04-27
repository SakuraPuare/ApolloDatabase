**TODO List (任务清单)**

**近期/正在进行：**

1. **爬虫脚本 (`spider.js`) 完善:**
    * **解决 MeiliSearch 连接/初始化问题：** 确保能成功连接 MeiliSearch 服务，并正确处理索引不存在自动创建的逻辑 (修复 `waitForTask` 相关错误，可能需要检查库版本或用法)。
    * **测试 ID 遍历逻辑：** 运行脚本，确认 ID 遍历、404 处理、连续 N 次 404 后停止的逻辑正常工作。
    * **测试增量更新逻辑：** 确认 `lastFetchDate.txt` 的读写以及基于日期的文章筛选逻辑按预期工作。
    * **数据发送至 MeiliSearch:** 确认爬取到的新文章数据能够成功、批量地添加到 MeiliSearch 索引中。
    * **错误处理：** 增强网络请求、HTML 解析、数据处理、MeiliSearch 交互等环节的错误处理和日志记录。

2. **MeiliSearch 配置与优化：**
    * **确认 MeiliSearch 服务稳定运行：** 确保 Docker 容器正常，数据已持久化。
    * **配置索引设置 (可选但推荐):**
        * 定义哪些字段可搜索 (`searchableAttributes`，如 `title`, `content`, `author`)。
        * 定义哪些字段可用于筛选/排序 (`filterableAttributes`, `sortableAttributes`，如 `publishTimestamp`, `author`, `views`)。
        * 调整排名规则 (`rankingRules`) 以优化搜索结果的相关性。

**中期：**

3. **后端 API 开发：**
    * 选择并设置 Node.js 后端框架 (如 Express, Fastify)。
    * 创建 `/search` API 路由。
    * 在该路由中：接收前端传来的搜索查询参数。
    * 使用 MeiliSearch Node.js 客户端，根据查询参数调用 MeiliSearch 的 `search` 方法。
    * 处理 MeiliSearch 返回的结果（格式化、提取需要的信息）。
    * 实现分页逻辑。
    * 将处理后的结果以 JSON 格式返回给前端。

4. **前端 UI 开发：**
    * 选择并设置前端技术栈 (如 React, Vue, 或纯 HTML/CSS/JS)。
    * 创建搜索页面 UI (包含搜索输入框、搜索按钮)。
    * 实现前端逻辑：
        * 获取用户输入。
        * 调用后端 `/search` API。
        * 处理 API 返回的搜索结果。
        * 在页面上渲染结果列表（标题、摘要、链接、作者、日期等）。
        * 实现分页控件和逻辑。
        * 处理加载状态和错误状态。

**远期/部署：**

5. **部署：**
    * 选择部署环境 (如云服务器、PaaS 平台)。
    * 部署 MeiliSearch 服务 (确保持久化和安全性)。
    * 部署 Node.js 后端 API 服务。
    * 部署前端静态文件或 Node.js SSR 应用。
    * **设置定时任务：** 配置爬虫脚本 (`spider.js`) 定期运行（例如每天一次），以获取最新文章并更新 MeiliSearch 索引。

6. **监控与维护：**
    * 监控爬虫运行状态和错误。
    * 监控 MeiliSearch、后端、前端服务的健康状况。
    * 根据目标网站的变化调整爬虫逻辑。

目前你的主要工作集中在 **TODO 列表的第 1 项**，即完善爬虫脚本并确保它能稳定地获取数据并将其存入 MeiliSearch。
