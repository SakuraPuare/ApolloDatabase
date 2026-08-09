"use client";

import React from "react";

interface HighlightTextProps {
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
  const displayText =
    maxLength && text.length > maxLength
      ? `${text.substring(0, maxLength)}...`
      : text;

  if (!displayText || !query.trim()) {
    return <span className={className}>{displayText}</span>;
  }

  const keywords = query
    .trim()
    .split(/\s+/)
    .filter((k) => k.length > 0);

  if (keywords.length === 0) {
    return <span className={className}>{displayText}</span>;
  }

  const regex = new RegExp(
    `(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );

  const parts = displayText.split(regex).filter(Boolean);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const isKeyword = keywords.some(
          (keyword) => part.toLowerCase() === keyword.toLowerCase()
        );
        return isKeyword ? (
          <mark key={i} className={highlightClassName}>
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </span>
  );
}
