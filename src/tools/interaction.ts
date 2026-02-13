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
        return okResult({ success: result.success, navigated: result.navigated ?? false });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "type_text",
    "Type text into an input field. Provide either a ref (from snapshot) or a CSS selector. Use ref when available; use selector as fallback when snapshot doesn't assign refs (common with combobox/autocomplete inputs). Call snapshot first to find target element.",
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
