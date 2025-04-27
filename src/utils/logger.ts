/**
 * 自定义日志工具，在生产环境中自动禁用 console.log
 */

const isDevelopment = process.env.NODE_ENV !== "production";

type LogLevel = "log" | "info" | "warn" | "error" | "debug";

/**
 * 创建特定级别的日志记录器
 * @param level 日志级别
 * @returns 日志函数
 */
const createLogger = (level: LogLevel) => {
  // 生产环境下，除了 warn 和 error 不输出其他日志
  if (!isDevelopment && !["warn", "error"].includes(level)) {
    return () => {};
  }

  return (...args: unknown[]) => {
    if (typeof console[level] === "function") {
      console[level](`[${level.toUpperCase()}]`, ...args);
    }
  };
};

export const logger = {
  log: createLogger("log"),
  info: createLogger("info"),
  warn: createLogger("warn"),
  error: createLogger("error"),
  debug: createLogger("debug"),
};

// 使用示例：
// import { logger } from '@/utils/logger';
// logger.log('这条日志在生产环境中不会显示');
// logger.error('这条错误日志在所有环境中都会显示');
