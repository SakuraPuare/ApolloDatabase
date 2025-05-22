import {
  MeiliSearch,
  Index as MeiliIndex,
  DocumentOptions,
  MeiliSearchApiError,
  ErrorStatusCode,
} from "meilisearch";
// ArticleDocument import might become unused and can be removed if so.
// If it's still used by other unshown parts of the file, keep it.
// For now, assuming it's only for the changed parts:
// import {
//   ArticleDocument,
// } from "@/lib/types";

const MEILI_HOST = process.env.MEILI_HOST || "http://localhost:7700";
const MEILI_API_KEY = process.env.MEILI_API_KEY || ""; // 如果有 API 密钥，可以从环境变量加载

// 创建 MeiliSearch 客户端
// 将 meiliClient 导出，以便在 services/meili.ts 中可能需要（例如，如果需要直接访问 tasks API）
// 但目前 services/meili.ts 中的函数并不直接需要它，因为 getOrCreateIndex 已经处理了任务等待
export const meiliClient = new MeiliSearch({
  host: MEILI_HOST,
  apiKey: MEILI_API_KEY,
});

/**
 * 索引配置接口
 */
export interface IndexConfig {
  primaryKey?: string;
  filterableAttributes?: string[];
  sortableAttributes?: string[];
}

/**
 * 获取或创建 MeiliSearch 索引并配置属性
 * @param indexName 索引名称
 * @param config 索引配置
 * @template T 文档类型
 */
export async function getOrCreateIndex<
  T extends Record<string, unknown> = Record<string, unknown>,
>(indexName: string, config?: IndexConfig): Promise<MeiliIndex<T>> {
  // 默认配置
  const defaultConfig: IndexConfig = {
    primaryKey: "id",
    filterableAttributes: [],
    sortableAttributes: [],
  };

  // 合并配置
  const finalConfig = {
    ...defaultConfig,
    ...config,
  };

  try {
    const index = meiliClient.index<T>(indexName);
    await index.getRawInfo(); // Checks if index exists
    console.log(`已连接到 MeiliSearch 索引：${indexName}`);

    // 应用配置
    if (
      finalConfig.filterableAttributes &&
      finalConfig.filterableAttributes.length > 0
    ) {
      await index.updateFilterableAttributes(finalConfig.filterableAttributes);
    }

    if (
      finalConfig.sortableAttributes &&
      finalConfig.sortableAttributes.length > 0
    ) {
      await index.updateSortableAttributes(finalConfig.sortableAttributes);
    }

    return index;
  } catch (error: unknown) {
    let createNeeded = false;

    if (error instanceof MeiliSearchApiError) {
      const cause = error.cause;
      const httpStatus = error.response?.status;

      if (cause?.code === ErrorStatusCode.INDEX_NOT_FOUND) {
        createNeeded = true;
      } else {
        console.error(
          `MeiliSearch API Error for index ${indexName}: ${error.message} (Code: ${cause?.code || "N/A"}, HTTPStatus: ${httpStatus || "N/A"}, Type: ${cause?.type || "N/A"})`,
        );
        throw error;
      }
    } else if (
      error instanceof Error &&
      error.message.includes(`Index \`${indexName}\` not found`)
    ) {
      createNeeded = true;
    } else {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `连接或处理 MeiliSearch 索引 ${indexName} 时遇到未预期错误：${errorMessage}`,
      );
      throw error;
    }

    if (createNeeded) {
      console.log(`索引 ${indexName} 不存在，正在创建...`);
      try {
        const taskResponse = await meiliClient.createIndex(indexName, {
          primaryKey: finalConfig.primaryKey,
        });
        console.log(
          `创建索引任务已提交，Task UID: ${taskResponse.taskUid}. 等待创建完成...`,
        );
        await meiliClient.tasks.waitForTask(taskResponse.taskUid, {
          timeout: 60000,
          interval: 100,
        });
        const newIndex = meiliClient.index<T>(indexName);
        console.log(`索引 ${indexName} 创建成功。`);

        // 创建后应用配置
        if (
          finalConfig.filterableAttributes &&
          finalConfig.filterableAttributes.length > 0
        ) {
          await newIndex.updateFilterableAttributes(
            finalConfig.filterableAttributes,
          );
        }

        if (
          finalConfig.sortableAttributes &&
          finalConfig.sortableAttributes.length > 0
        ) {
          await newIndex.updateSortableAttributes(
            finalConfig.sortableAttributes,
          );
        }

        return newIndex;
      } catch (creationError: unknown) {
        const creationErrorMessage =
          creationError instanceof Error
            ? creationError.message
            : String(creationError);
        console.error(
          `创建 MeiliSearch 索引 ${indexName} 时出错:`,
          creationErrorMessage,
        );
        throw creationError;
      }
    }
    // This part should not be reached if createNeeded is false and an error was already thrown.
    throw new Error(
      `Unhandled state in getOrCreateIndex for index ${indexName}`,
    );
  }
}

export async function addDocumentsWithRetry<T extends Record<string, unknown>>(
  indexName: string,
  documents: T[],
  batchSize = 1000,
  retries = 3,
  config?: IndexConfig,
) {
  const index = await getOrCreateIndex<T>(indexName, config);

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    let attempt = 0;
    while (attempt < retries) {
      try {
        console.log(
          `Attempt ${attempt + 1}: Adding batch ${
            i / batchSize + 1
          } to index "${indexName}"...`,
        );
        const taskResponse = await index.addDocuments(batch, {
          primaryKey: config?.primaryKey || "id",
        } as DocumentOptions);
        console.log(
          `Task ${taskResponse.taskUid} created for batch ${
            i / batchSize + 1
          }. Waiting for completion...`,
        );
        await meiliClient.tasks.waitForTask(taskResponse.taskUid, {
          timeout: 60000,
          interval: 100,
        });
        console.log(`Batch ${i / batchSize + 1} added successfully.`);
        break;
      } catch (error) {
        attempt++;
        console.error(
          `Error adding batch ${i / batchSize + 1} (Attempt ${attempt}):`,
          error,
        );
        if (attempt >= retries) {
          console.error(
            `Failed to add batch ${
              i / batchSize + 1
            } after ${retries} attempts.`,
          );
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)),
        );
      }
    }
  }
  console.log(`All documents added to index "${indexName}".`);
}
