import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ToolDeps } from "./server.js";

export function registerPrompts(server: McpServer, deps: ToolDeps): void {
  server.registerPrompt(
    "setup-verify",
    {
      description: "Verify CamoFox MCP setup is working. Runs health check, smoke test, and profile check."
    },
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Verify my CamoFox MCP setup (server URL: ${deps.config.camofoxUrl}). Run these checks and report results:

1) Call \`server_status\` — is the browser server connected?
2) If connected: \`create_tab\` with url \`https://example.com\` and userId \`setup-test\`
3) \`navigate_and_snapshot\` on that tab (wait for text: "Example Domain")
4) \`list_profiles\` to confirm profile storage is accessible
5) \`close_tab\` for the test tab

If any step fails, diagnose the issue and suggest a fix.
Report: ✅ pass or ❌ fail for each step, plus overall status.`
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "troubleshoot",
    {
      description: "Diagnose and fix common CamoFox issues. Optionally describe the symptom.",
      argsSchema: {
        symptom: z.string().optional().describe("What's not working (e.g., 'connection refused', 'forbidden error')")
      }
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Something isn't working with my CamoFox setup.${args.symptom ? ` Symptom: ${args.symptom}` : ""}

Please diagnose:
1) Call \`server_status\` — check browser server connection
2) If connected, try \`create_tab\` and navigate to any URL
3) If that works, try \`import_cookies\` with a simple test cookie
4) Report what's working and what's failing
5) Suggest specific fixes for any issues found

Common issues:
- Connection refused → CamoFox Browser Server not running or wrong CAMOFOX_URL
- "Forbidden" → API key mismatch between MCP and browser server
- "API key required" → Set CAMOFOX_API_KEY env var
- Profiles not auto-restoring → Need CAMOFOX_API_KEY + CAMOFOX_AUTO_SAVE=true`
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "quick-start",
    {
      description: "Get started with CamoFox — basic browsing workflow guide.",
      argsSchema: {
        task: z.string().optional().describe("What you want to do (e.g., 'scrape a website', 'fill a form')")
      }
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help me get started with CamoFox MCP.${args.task ? ` I want to: ${args.task}` : ""}

Basic workflow:
1) \`server_status\` — verify connection
2) \`create_tab\` with userId and target URL — opens anti-detection browser tab
3) \`snapshot\` — get accessibility tree (primary way to read pages, token-efficient)
4) \`click\` / \`type_text\` — interact with elements using ref numbers from snapshot
5) \`navigate_and_snapshot\` — go to new pages
6) \`close_tab\` when done

Tips:
- Use \`snapshot\` (not \`screenshot\`) for reading pages — 90% fewer tokens
- Use \`web_search\` for search engine queries (14 engines supported)
- Use \`fill_form\` to fill multiple fields at once
- Use \`import_cookies\` to restore login sessions
- Each tab gets a unique anti-detection fingerprint automatically`
          }
        }
      ]
    })
  );
}
