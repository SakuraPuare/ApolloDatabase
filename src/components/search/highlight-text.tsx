"use client";

import { cn } from "@/utils/utils";
import React from "react";

export interface HighlightTextProps {
  text: string;
  query: string;
  className?: string;
  highlightClassName?: string;
  maxLength?: number;
}

export default function HighlightText({
  text,
  query,
  className = "",
  highlightClassName = "bg-yellow-200 font-medium",
  maxLength,
}: HighlightTextProps) {
  // 如果没有文本或查询为空，直接返回原文本（先清除 HTML 标签）
  const cleanHtml = (htmlText: string): string => {
    // 首先移除所有 HTML 标签
    let clean = htmlText.replace(/<[^>]*>/g, ' ');
    // 将多个空格替换为单个空格
    clean = clean.replace(/\s+/g, ' ');
    // 解码常见的 HTML 实体
    clean = clean.replace(/&amp;/g, '&')
                 .replace(/&lt;/g, '<')
                 .replace(/&gt;/g, '>')
                 .replace(/&quot;/g, '"')
                 .replace(/&nbsp;/g, ' ')
                 .replace(/&#39;/g, "'");
    // 去除首尾空格
    return clean.trim();
  };

  // 清除 HTML 标签
  const cleanText = cleanHtml(text || '');
  
  if (!cleanText || !query.trim()) {
    const displayText = maxLength && cleanText.length > maxLength 
      ? `${cleanText.substring(0, maxLength)}...` 
      : cleanText;
    return <span className={className}>{displayText}</span>;
  }

  // 如果需要截断文本
  const displayText = maxLength && cleanText.length > maxLength 
    ? cleanText.substring(0, maxLength) + "..." 
    : cleanText;

  // 查找关键词的位置
  const keywords = query.trim().split(/\s+/).filter(k => k.length > 0);
  
  if (keywords.length === 0) {
    return <span className={className}>{displayText}</span>;
  }

  // 构建正则表达式，用于匹配所有关键词（不区分大小写）
  const regex = new RegExp(`(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  
  // 分割文本
  const parts = displayText.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        // 检查这部分是否匹配任何关键词
        const isKeyword = keywords.some(keyword => 
          part.toLowerCase() === keyword.toLowerCase()
        );
        
        return isKeyword ? (
          <span key={i} className={cn(highlightClassName, className)}>
            {part}
          </span>
        ) : (
          part
        );
      })}
    </span>
  );
} 