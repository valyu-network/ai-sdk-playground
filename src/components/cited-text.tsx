"use client";

import { useMemo, createContext, useContext, ReactNode } from "react";
import { Streamdown } from "streamdown";
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation";
import { Badge } from "@/components/ui/badge";
import { HoverCardTrigger } from "@/components/ui/hover-card";

export interface Citation {
  number: string;
  title: string;
  url: string;
  description?: string;
}

interface CitedTextProps {
  text: string;
  citations: Citation[];
  isAnimating?: boolean;
}

const CitationsContext = createContext<Citation[]>([]);

function getFaviconUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    if (hostname === "valyu.ai" || hostname.endsWith(".valyu.ai")) {
      return "/favicon.ico";
    }
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return "";
  }
}

function CitationBadge({ citation }: { citation: Citation }) {
  const faviconUrl = getFaviconUrl(citation.url);
  let hostname = "unknown";
  try {
    hostname = new URL(citation.url).hostname;
  } catch {
    /* invalid URL */
  }

  return (
    <InlineCitation>
      <InlineCitationCard>
        <HoverCardTrigger asChild>
          <Badge
            className="ml-0.5 rounded-full cursor-pointer inline-flex items-center gap-1 align-middle"
            variant="secondary"
          >
            {faviconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={faviconUrl}
                alt=""
                width={12}
                height={12}
                className="rounded-sm"
              />
            )}
            <span>{hostname}</span>
          </Badge>
        </HoverCardTrigger>
        <InlineCitationCardBody>
          <InlineCitationCarousel>
            <InlineCitationCarouselHeader>
              <div className="flex items-center gap-2">
                {faviconUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={faviconUrl}
                    alt=""
                    width={16}
                    height={16}
                    className="rounded-sm"
                  />
                )}
                <span className="text-xs font-medium truncate max-w-[200px]">
                  {citation.title}
                </span>
              </div>
              <InlineCitationCarouselIndex />
            </InlineCitationCarouselHeader>
            <InlineCitationCarouselContent>
              <InlineCitationCarouselItem>
                <InlineCitationSource
                  title={citation.title}
                  url={citation.url}
                  description={citation.description}
                />
              </InlineCitationCarouselItem>
            </InlineCitationCarouselContent>
          </InlineCitationCarousel>
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  );
}

function processTextWithCitations(text: string, citations: Citation[]): ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);

  return parts.map((part, index) => {
    const citationMatch = part.match(/\[(\d+)\]/);
    if (citationMatch) {
      const citationNumber = citationMatch[1];
      const citation = citations.find((c) => c.number === citationNumber);
      if (citation) {
        return <CitationBadge key={index} citation={citation} />;
      }
    }
    return part;
  });
}

function TextWithCitations({ children }: { children?: ReactNode }) {
  const citations = useContext(CitationsContext);

  if (typeof children === "string") {
    return <>{processTextWithCitations(children, citations)}</>;
  }

  return <>{children}</>;
}

function ParagraphWithCitations({ children }: { children?: ReactNode }) {
  const citations = useContext(CitationsContext);

  const processChildren = (child: ReactNode): ReactNode => {
    if (typeof child === "string") {
      return processTextWithCitations(child, citations);
    }
    return child;
  };

  const processed = Array.isArray(children)
    ? children.map((child, i) => <span key={i}>{processChildren(child)}</span>)
    : processChildren(children);

  return <p>{processed}</p>;
}

function HeadingWithCitations({ level, children }: { level: 1 | 2 | 3 | 4 | 5 | 6; children?: ReactNode }) {
  const citations = useContext(CitationsContext);
  const Tag = `h${level}` as const;

  const processChildren = (child: ReactNode): ReactNode => {
    if (typeof child === "string") {
      return processTextWithCitations(child, citations);
    }
    return child;
  };

  const processed = Array.isArray(children)
    ? children.map((child, i) => <span key={i}>{processChildren(child)}</span>)
    : processChildren(children);

  return <Tag>{processed}</Tag>;
}

function ListItemWithCitations({ children }: { children?: ReactNode }) {
  const citations = useContext(CitationsContext);

  const processChildren = (child: ReactNode): ReactNode => {
    if (typeof child === "string") {
      return processTextWithCitations(child, citations);
    }
    return child;
  };

  const processed = Array.isArray(children)
    ? children.map((child, i) => <span key={i}>{processChildren(child)}</span>)
    : processChildren(children);

  return <li>{processed}</li>;
}

function StrongWithCitations({ children }: { children?: ReactNode }) {
  const citations = useContext(CitationsContext);

  const processChildren = (child: ReactNode): ReactNode => {
    if (typeof child === "string") {
      return processTextWithCitations(child, citations);
    }
    return child;
  };

  const processed = Array.isArray(children)
    ? children.map((child, i) => <span key={i}>{processChildren(child)}</span>)
    : processChildren(children);

  return <strong>{processed}</strong>;
}

export function CitedText({ text, citations, isAnimating }: CitedTextProps) {
  const components = useMemo(() => ({
    p: ParagraphWithCitations,
    h1: (props: { children?: ReactNode }) => <HeadingWithCitations level={1} {...props} />,
    h2: (props: { children?: ReactNode }) => <HeadingWithCitations level={2} {...props} />,
    h3: (props: { children?: ReactNode }) => <HeadingWithCitations level={3} {...props} />,
    h4: (props: { children?: ReactNode }) => <HeadingWithCitations level={4} {...props} />,
    h5: (props: { children?: ReactNode }) => <HeadingWithCitations level={5} {...props} />,
    h6: (props: { children?: ReactNode }) => <HeadingWithCitations level={6} {...props} />,
    li: ListItemWithCitations,
    strong: StrongWithCitations,
  }), []);

  return (
    <CitationsContext.Provider value={citations}>
      <Streamdown
        className="size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
        isAnimating={isAnimating}
        components={components}
      >
        {text}
      </Streamdown>
    </CitationsContext.Provider>
  );
}

export function extractCitationsFromToolResults(
  parts: Array<{ type: string; output?: unknown; state?: string }>
): Citation[] {
  const citations: Citation[] = [];
  let citationIndex = 1;

  for (const part of parts) {
    if (
      (part.type === "dynamic-tool" || part.type.startsWith("tool-")) &&
      part.state === "output-available" &&
      part.output
    ) {
      const output = part.output as {
        results?: Array<{ title?: string; url?: string; content?: string }>;
        search_results?: Array<{ title?: string; url?: string; content?: string }>;
      };

      const results = output.results || output.search_results || [];

      for (const result of results) {
        if (result.url) {
          citations.push({
            number: String(citationIndex),
            title: result.title || "Source",
            url: result.url,
            description: result.content?.slice(0, 200),
          });
          citationIndex++;
        }
      }
    }
  }

  return citations;
}
