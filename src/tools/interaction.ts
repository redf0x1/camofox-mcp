import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { okResult, toErrorResult } from "../errors.js";
import { getTrackedTab, incrementToolCall } from "../state.js";
import type { ToolDeps } from "../server.js";

export function registerInteractionTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "click",
    "Click an element. Provide either ref (from snapshot) or CSS selector. Use snapshot first to discover element refs.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      ref: z.string().min(1).optional().describe("Element ref from snapshot (e.g. 'e1', 'e2')"),
      selector: z.string().min(1).optional().describe("CSS selector (e.g. 'button.submit', '#login')")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            ref: z.string().min(1).optional().describe("Element ref from snapshot (e.g. 'e1', 'e2')"),
            selector: z.string().min(1).optional().describe("CSS selector (e.g. 'button.submit', '#login')")
          })
          .refine((data) => Boolean(data.ref || data.selector), {
            message: "Either 'ref' or 'selector' is required"
          })
          .parse(input);

        const tracked = getTrackedTab(parsed.tabId);
        const result = await deps.client.click(parsed.tabId, {
          ref: parsed.ref,
          selector: parsed.selector
        }, tracked.userId);
        incrementToolCall(parsed.tabId);
        return okResult({
          success: result.success,
          navigated: result.navigated,
          refsAvailable: result.refsAvailable
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "type_text",
    "Type text into an input field. Provide either a ref (from snapshot) or a CSS selector. Use ref when available; otherwise use selector when snapshot doesn't assign refs (common with combobox/autocomplete inputs). Call snapshot first to find target element.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      ref: z.string().min(1).optional().describe("Element ref from snapshot (e.g. 'e1', 'e2')"),
      selector: z.string().min(1).optional().describe("CSS selector (e.g. 'input[name=q]', '#search-input')"),
      text: z.string().describe("Text to type into the element. Replaces existing content.")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            ref: z.string().min(1).optional().describe("Element ref from snapshot (e.g. 'e1', 'e2')"),
            selector: z.string().min(1).optional().describe("CSS selector (e.g. 'input[name=q]', '#search-input')"),
            text: z.string().describe("Text to type into the element. Replaces existing content.")
          })
          .refine((data) => Boolean(data.ref || data.selector), {
            message: "Either 'ref' or 'selector' is required"
          })
          .parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        await deps.client.typeText(parsed.tabId, { ref: parsed.ref, selector: parsed.selector }, parsed.text, tracked.userId);
        incrementToolCall(parsed.tabId);
        return okResult({ success: true });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "scroll",
    "Scroll page up or down by pixel amount. Use to reveal content below the fold or navigate long pages.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      direction: z.enum(["up", "down"]).describe("Scroll direction"),
      amount: z.number().int().positive().optional().describe("Pixels to scroll (default: 500)")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            direction: z.enum(["up", "down"]).describe("Scroll direction"),
            amount: z.number().int().positive().optional().describe("Pixels to scroll (default: 500)")
          })
          .parse(input);

        const tracked = getTrackedTab(parsed.tabId);
        await deps.client.scroll(parsed.tabId, parsed.direction, parsed.amount, tracked.userId);
        incrementToolCall(parsed.tabId);
        return okResult({ success: true });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "camofox_scroll_element",
    "Scroll a specific container element (modal dialog, scrollable div, sidebar). Use when page-level scroll doesn't reach content inside modals or overflow containers. Returns scroll position metadata to track progress.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      selector: z.string().min(1).optional().describe("CSS selector for scrollable container (e.g. '[role=dialog]', '.modal-body')"),
      ref: z.string().min(1).optional().describe("Element ref from snapshot (e.g. 'e5')"),
      deltaY: z.number().default(300).describe("Vertical scroll pixels (positive=down, negative=up)"),
      deltaX: z.number().default(0).describe("Horizontal scroll pixels")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            selector: z.string().min(1).optional().describe("CSS selector for scrollable container (e.g. '[role=dialog]', '.modal-body')"),
            ref: z.string().min(1).optional().describe("Element ref from snapshot (e.g. 'e5')"),
            deltaY: z.number().default(300).describe("Vertical scroll pixels (positive=down, negative=up)"),
            deltaX: z.number().default(0).describe("Horizontal scroll pixels")
          })
          .refine((data) => Boolean(data.ref || data.selector), {
            message: "Either 'ref' or 'selector' is required"
          })
          .parse(input);

        const tracked = getTrackedTab(parsed.tabId);
        const result = await deps.client.scrollElement(parsed.tabId, {
          selector: parsed.selector,
          ref: parsed.ref,
          deltaX: parsed.deltaX,
          deltaY: parsed.deltaY
        }, tracked.userId);
        incrementToolCall(parsed.tabId);

        return okResult({
          ok: result.ok,
          scrollPosition: result.scrollPosition
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "camofox_evaluate_js",
    "Execute JavaScript in the browser page context. Runs in isolated scope (invisible to page scripts — safe for anti-detection). Use for: extracting data not visible in accessibility snapshot, checking element properties, reading computed styles, manipulating DOM elements. Requires CAMOFOX_API_KEY to be configured.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      expression: z.string().min(1).describe(
        "JavaScript expression to evaluate (e.g. 'document.title', 'document.querySelectorAll(\"img\").length', 'document.querySelector(\".modal\").scrollHeight')"
      ),
      timeout: z.number().int().positive().max(30000).optional().default(5000).describe("Execution timeout in ms (max 30000)")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            expression: z.string().min(1).describe(
              "JavaScript expression to evaluate (e.g. 'document.title', 'document.querySelectorAll(\"img\").length', 'document.querySelector(\".modal\").scrollHeight')"
            ),
            timeout: z.number().int().min(100).max(30000).optional().default(5000).describe("Execution timeout in ms (max 30000)")
          })
          .parse(input);

        const tracked = getTrackedTab(parsed.tabId);
        const result = await deps.client.evaluate(parsed.tabId, parsed.expression, tracked.userId, parsed.timeout);
        incrementToolCall(parsed.tabId);

        if (result.ok) {
          const inferredType =
            result.resultType ??
            (result.result === null
              ? "null"
              : Array.isArray(result.result)
                ? "array"
                : typeof result.result);

          return okResult({
            ok: true,
            result: result.result,
            resultType: inferredType,
            truncated: result.truncated ?? false
          });
        }

        const errorType = result.errorType ?? "Error";
        const isTimeout = /timeout/i.test(errorType) || /timeout/i.test(result.error ?? "");
        const message = isTimeout
          ? `Evaluation timed out after ${parsed.timeout}ms`
          : (result.error ?? "JavaScript evaluation failed");

        return okResult({
          ok: false,
          error: message,
          errorType
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "camofox_hover",
    "Hover over an element to trigger tooltips, dropdown menus, or hover states. Use ref from snapshot or CSS selector.",
    {
      tabId: z.string().describe("Tab ID"),
      ref: z.string().optional().describe("Element ref from snapshot (e.g. 'e5')"),
      selector: z.string().optional().describe("CSS selector (e.g. '#menu-item', '.dropdown-trigger')")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().describe("Tab ID"),
            ref: z.string().optional().describe("Element ref from snapshot (e.g. 'e5')"),
            selector: z.string().optional().describe("CSS selector (e.g. '#menu-item', '.dropdown-trigger')")
          })
          .refine((data) => Boolean(data.ref || data.selector), {
            message: "Error: provide either ref or selector"
          })
          .parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        await deps.client.hover(parsed.tabId, { ref: parsed.ref, selector: parsed.selector }, tracked.userId);
        incrementToolCall(parsed.tabId);
        return okResult({
          message: `Hovered on ${parsed.ref ? `ref=${parsed.ref}` : `selector=${parsed.selector}`}`
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "camofox_wait_for",
    "Wait for page to be fully ready (DOM loaded, network idle, framework hydration complete). Use after navigation or actions that trigger page changes.",
    {
      tabId: z.string().describe("Tab ID"),
      timeout: z.number().optional().describe("Timeout in ms (default: 10000)"),
      waitForNetwork: z.boolean().optional().describe("Wait for network idle (default: true)")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().describe("Tab ID"),
            timeout: z.number().optional().describe("Timeout in ms (default: 10000)"),
            waitForNetwork: z.boolean().optional().describe("Wait for network idle (default: true)")
          })
          .parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        const result = await deps.client.waitForReady(parsed.tabId, tracked.userId, parsed.timeout, parsed.waitForNetwork);
        incrementToolCall(parsed.tabId);
        return okResult({
          message: result.ready ? "Page is ready" : "Page wait timed out",
          ready: result.ready
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );
}

export function registerPressKeyTool(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "camofox_press_key",
    "Press a keyboard key. Use after type_text to submit forms (Enter), navigate between elements (Tab), move through suggestions (ArrowDown/ArrowUp), or dismiss dialogs (Escape). Common keys: Enter, Tab, Escape, ArrowDown, ArrowUp, Backspace, Space.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      key: z.string().min(1).describe("Key to press (e.g. 'Enter', 'Escape', 'Tab', 'ArrowDown')")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            key: z.string().min(1).describe("Key to press (e.g. 'Enter', 'Escape', 'Tab', 'ArrowDown')")
          })
          .parse(input);
        const tracked = getTrackedTab(parsed.tabId);
        await deps.client.pressKey(parsed.tabId, parsed.key, tracked.userId);
        incrementToolCall(parsed.tabId);
        return okResult({ success: true });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );
}
