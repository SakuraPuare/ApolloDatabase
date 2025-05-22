"use client";

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
  // Helper function to parse HTML and extract text content
  const extractTextFromHtml = (htmlString: string): string => {
    // This component is 'use client', so DOMParser is available.
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, "text/html");

      // Function to recursively remove unwanted nodes (comments, scripts, styles)
      const removeNodes = (node: Node) => {
        let child = node.firstChild;
        while (child) {
          const nextChild = child.nextSibling; // Store next sibling before potential removal
          if (
            child.nodeType === Node.COMMENT_NODE ||
            child.nodeType === Node.DOCUMENT_TYPE_NODE // Though DOCUMENT_TYPE_NODE is usually not a child in this context
          ) {
            node.removeChild(child);
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tagName = (child as Element).tagName;
            if (tagName === "SCRIPT" || tagName === "STYLE") {
              node.removeChild(child);
            } else {
              // Recursively call on children of other elements
              removeNodes(child);
            }
          }
          child = nextChild;
        }
      };

      // FIXME: not here
      const docContentElement = doc.getElementById("doc-content");
      let rawText = "";

      if (docContentElement) {
        // If #doc-content exists, clean and extract text only from it
        removeNodes(docContentElement); // Clean the specific element in place
        rawText = docContentElement.textContent || "";
      } else {
        // Otherwise, fallback to cleaning head and body from the whole document
        if (doc.head) {
          removeNodes(doc.head);
        }
        if (doc.body) {
          removeNodes(doc.body);
        }
        // Extract text from the body, or the whole document if body is empty/missing
        rawText =
          doc.body?.textContent || doc.documentElement?.textContent || "";
      }

      // Replace multiple whitespace characters (including newlines, tabs) with a single space and trim.
      return rawText.replace(/\s+/g, " ").trim();
    } catch (error) {
      // Fallback to a very basic tag strip if DOMParser fails for some unexpected reason.
      // This indicates an issue with the input HTML string itself.
      console.error("Error parsing HTML string:", error);
      return htmlString
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  };

  // Extract and clean text from the input HTML string
  const cleanText = extractTextFromHtml(text || "");

  if (!cleanText || !query.trim()) {
    const displayTextContent =
      maxLength && cleanText.length > maxLength
        ? `${cleanText.substring(0, maxLength)}...`
        : cleanText;
    return <span className={className}>{displayTextContent}</span>;
  }

  // Apply maxLength to the cleaned text if necessary
  const displayText =
    maxLength && cleanText.length > maxLength
      ? `${cleanText.substring(0, maxLength)}...`
      : cleanText;

  const keywords = query
    .trim()
    .split(/\s+/)
    .filter((k: string) => k.length > 0);

  if (keywords.length === 0) {
    return <span className={className}>{displayText}</span>;
  }

  // Prepare regex for splitting the text by keywords (case-insensitive)
  const regex = new RegExp(
    `(${keywords.map((k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );

  // Split text by keywords, filter(Boolean) removes empty strings that can result from split
  const parts = displayText.split(regex).filter(Boolean);

  return (
    <span className={className}>
      {parts.map((part: string, i: number) => {
        const isKeyword = keywords.some(
          (keyword: string) => part.toLowerCase() === keyword.toLowerCase(),
        );

        return isKeyword ? (
          // Use <mark> for semantically correct highlighting
          // Apply only highlightClassName to the mark tag
          <mark key={i} className={highlightClassName}>
            {part}
          </mark>
        ) : (
          part
        );
      })}
    </span>
  );
}
