"use client";

import React from "react";

interface HighlightTextProps {
  text: string;
  query: string;
  maxLength?: number;
}

export default function HighlightText({
  text,
  query,
  maxLength,
}: HighlightTextProps) {
  const displayText =
    maxLength && text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;

  if (!displayText || !query.trim()) {
    return <>{displayText}</>;
  }

  const keywords = query
    .trim()
    .split(/\s+/)
    .filter((k) => k.length > 0);

  if (keywords.length === 0) {
    return <>{displayText}</>;
  }

  const regex = new RegExp(
    `(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );

  const parts = displayText.split(regex).filter(Boolean);

  return (
    <>
      {parts.map((part, i) => {
        const isKeyword = keywords.some(
          (keyword) => part.toLowerCase() === keyword.toLowerCase()
        );
        return isKeyword ? (
          <mark
            key={i}
            className="bg-yellow-200/80 dark:bg-yellow-500/30 text-inherit rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </>
  );
}
