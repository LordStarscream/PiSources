/**
 * Web Search Extension
 *
 * Provides web_search and fetch_url tools for concept discussions, documentation
 * lookups, and external knowledge gathering. Wraps the web-bash skill's
 * fetch_md.sh tool and DuckDuckGo/Stack Overflow/Wikipedia APIs.
 *
 * Use when the agent needs information not available in the local project directory.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Path to the fetch markdown tool from the web-bash skill
const FETCH_MD_SCRIPT = process.env.HOME
  ? `${process.env.HOME}/.pi/agent/skills/web-bash/tools/fetch_md.sh`
  : "~/.pi/agent/skills/web-bash/tools/fetch_md.sh";

const SEARCH_PARAMS = {
  query: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "The topic or question to search for",
      },
      maxResults: {
        type: "number",
        description: "Maximum number of URLs to return (1-10)",
        default: 3,
      },
    },
    required: ["topic"],
  },
} as const;

const FETCH_PARAMS = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "URL to fetch and convert to markdown",
    },
    maxTokens: {
      type: "number",
      description: "Maximum tokens to extract (default: 10000)",
      default: 10000,
    },
  },
  required: ["url"],
} as const;

const FETCH_MANY_PARAMS = {
  type: "object",
  properties: {
    urls: {
      type: "array",
      items: { type: "string" },
      description: "List of URLs to fetch (1-5)",
      minItems: 1,
      maxItems: 5,
    },
    maxTokensPerUrl: {
      type: "number",
      description: "Maximum tokens per URL (default: 10000)",
      default: 10000,
    },
  },
  required: ["urls"],
} as const;

export default function (pi: ExtensionAPI) {
  // Track state across turns
  const recentSearches: Array<{ topic: string; timestamp: number }> = [];

  // Helper: run fetch_md.sh
  const runFetchMd = async (url: string, signal?: AbortSignal): Promise<string> => {
    const result = await pi.exec(
      "bash",
      ["-c", `bash "${FETCH_MD_SCRIPT}" "${url}" 2>/dev/null`],
      { timeout: 15000, signal }
    );
    return (result.stdout || "").trim();
  };

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web for information not in the local project. " +
      "Uses DuckDuckGo for search, fetch_md.sh to extract content as markdown. " +
      "For Stack Overflow questions, prefer searching the project first or use fetch_url on the SO page.",
    promptSnippet: "Search the web for concepts, documentation, or external information",
    promptGuidelines: [
      "Use web_search when the user asks about concepts, patterns, or technologies not in the project.",
      "Use web_search for error messages that need external debugging help.",
      "Do not use web_search for project-specific questions — search the local directory first.",
      "For Stack Overflow errors, first search the project; if not found, web_search the error message.",
    ],
    parameters: SEARCH_PARAMS as any,
    async execute(_toolCallId, params: { topic: string; maxResults?: number }) {
      const maxResults = params.maxResults ?? 3;
      const topic = encodeURIComponent(params.topic);

      // DuckDuckGo search
      const searchCmd = `curl -sL "https://html.duckduckgo.com/html/?q=${topic}" \
        | grep -oP 'class="result__a"[^>]*href="\\K[^"]+' \
        | head -${maxResults}`;

      const searchResult = await pi.exec("bash", ["-c", searchCmd]);

      const urls = (searchResult.stdout || "")
        .trim()
        .split("\n")
        .filter((u) => u.startsWith("http"));

      if (urls.length === 0) {
        return {
          content: [
            { type: "text", text: `No results found for "${params.topic}". Try rephrasing your query.` },
          ],
          details: { queries: 1, results: 0 },
        };
      }

      // Fetch top results as markdown
      const results: string[] = [];
      for (let i = 0; i < Math.min(urls.length, maxResults); i++) {
        try {
          const content = await runFetchMd(urls[i].trim());
          if (content) {
            results.push(`--- Source ${i + 1}: ${urls[i].trim()}\n${content}\n---`);
          }
        } catch {
          // Skip failed fetches
        }
      }

      recentSearches.push({ topic: params.topic, timestamp: Date.now() });
      if (recentSearches.length > 10) recentSearches.shift();

      const combined = results.join("\n\n");

      return {
        content: [{ type: "text", text: `Search results for "${params.topic}":\n\n${combined}` }],
        details: { queries: 1, urlsFound: urls.length, contentBlocks: results.length },
      };
    },
  });

  pi.registerTool({
    name: "fetch_url",
    label: "Fetch URL",
    description:
      "Fetch a specific URL and extract its content as clean markdown. " +
      "Uses the web-bash fetch_md.sh fallback chain (pandoc > lynx > python). " +
      "Great for documentation pages, articles, and API references.",
    promptSnippet: "Fetch a URL and extract its content as markdown",
    promptGuidelines: [
      "Use fetch_url to read a specific documentation page or article.",
      "Use fetch_url when you have a direct URL but need it in readable markdown.",
      "For very long pages, reduce maxTokens to focus on the most relevant content.",
    ],
    parameters: FETCH_PARAMS as any,
    async execute(_toolCallId, params: { url: string; maxTokens?: number }) {
      try {
        const content = await runFetchMd(params.url);
        const truncated = content.length > params.maxTokens! * 1000
          ? content.slice(0, params.maxTokens! * 1000) + "\n\n[Content truncated]"
          : content;

        return {
          content: [{ type: "text", text: `Content from ${params.url}:\n\n${truncated}` }],
          details: { status: "success", contentLength: content.length },
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error fetching "${params.url}": ${err?.message || "Unknown error"}` }],
          details: { status: "error", url: params.url },
        };
      }
    },
  });

  pi.registerTool({
    name: "fetch_many",
    label: "Fetch Many URLs",
    description:
      "Batch-fetch multiple URLs and return their markdown content. " +
      "Useful for comparing documentation, reading multiple sources, or gathering context.",
    promptSnippet: "Batch fetch multiple URLs and extract content as markdown",
    promptGuidelines: [
      "Use fetch_many when you need to compare content from multiple URLs at once.",
      "Limit to 5 URLs per call. Use web_search first to discover the right URLs.",
    ],
    parameters: FETCH_MANY_PARAMS as any,
    async execute(_toolCallId, params: { urls: string[]; maxTokensPerUrl?: number }) {
      const results: string[] = [];

      for (const url of params.urls) {
        try {
          const content = await runFetchMd(url);
          if (content) {
            results.push(`--- ${url}\n${content.slice(0, params.maxTokensPerUrl! * 1000)}\n---`);
          }
        } catch {
          results.push(`--- ${url}\n[Failed to fetch]\n---`);
        }
      }

      return {
        content: [{ type: "text", text: results.join("\n\n") }],
        details: { fetched: results.filter((r) => !r.includes("[Failed")).length, total: params.urls.length },
      };
    },
  });
}
