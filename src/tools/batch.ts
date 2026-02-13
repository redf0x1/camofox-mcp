import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { normalizeError, okResult, toErrorResult, type ToolResult } from "../errors.js";
import { getTrackedTab, incrementToolCall, updateRefsCount, updateTabUrl } from "../state.js";
import type { ToolDeps } from "../server.js";

function jsonResult(data: unknown, isError = false): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    isError
  };
}

const fieldSchema = z
  .object({
    ref: z.string().min(1).optional().describe("Element ref from snapshot (e.g. 'e1')"),
    selector: z.string().min(1).optional().describe("CSS selector (e.g. 'input[name=email]')"),
    text: z.string().describe("Text to type into the field")
  })
  .refine((data) => Boolean(data.ref || data.selector), {
    message: "Each field must provide either 'ref' or 'selector'"
  });

const submitSchema = z
  .object({
    ref: z.string().min(1).optional().describe("Submit button ref"),
    selector: z.string().min(1).optional().describe("Submit button CSS selector")
  })
  .refine((data) => Boolean(data.ref || data.selector), {
    message: "Submit must provide either 'ref' or 'selector'"
  });

const clickSchema = z
  .object({
    ref: z.string().min(1).optional().describe("Element ref from snapshot"),
    selector: z.string().min(1).optional().describe("CSS selector"),
    description: z.string().optional().describe("Optional description of what this click does")
  })
  .refine((data) => Boolean(data.ref || data.selector), {
    message: "Each click must provide either 'ref' or 'selector'"
  });

export function registerBatchTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "fill_form",
    "Fill multiple form fields in one call. Provide an array of field entries, each with a ref or CSS selector and the text to type. Optionally specify a submit button to click after filling.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      fields: z.array(fieldSchema).min(1).max(20).describe("Array of form fields to fill"),
      submit: submitSchema.optional().describe("Optional submit button to click after filling all fields")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            fields: z.array(fieldSchema).min(1).max(20).describe("Array of form fields to fill"),
            submit: submitSchema.optional().describe("Optional submit button to click after filling all fields")
          })
          .parse(input);

        const tracked = getTrackedTab(parsed.tabId);
        const results: Array<{ index: number; ref?: string; selector?: string; success: boolean; error?: string }> = [];

        for (let index = 0; index < parsed.fields.length; index += 1) {
          const field = parsed.fields[index];
          try {
            await deps.client.typeText(parsed.tabId, { ref: field.ref, selector: field.selector }, field.text, tracked.userId);
            results.push({ index, ref: field.ref, selector: field.selector, success: true });
          } catch (error) {
            const appError = normalizeError(error);
            results.push({ index, ref: field.ref, selector: field.selector, success: false, error: appError.message });
            return jsonResult(
              {
                success: false,
                filled: results.filter((result) => result.success).length,
                total: parsed.fields.length,
                results,
                submitted: false
              },
              true
            );
          }
        }

        let submitted: boolean | undefined;
        if (parsed.submit) {
          await deps.client.click(parsed.tabId, { ref: parsed.submit.ref, selector: parsed.submit.selector }, tracked.userId);
          submitted = true;
        }

        incrementToolCall(parsed.tabId);

        return jsonResult({
          success: true,
          filled: parsed.fields.length,
          total: parsed.fields.length,
          results,
          ...(submitted !== undefined ? { submitted } : {})
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "type_and_submit",
    "Type text into a field and press a key (default: Enter). Useful for search boxes and single-field forms.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      ref: z.string().min(1).optional().describe("Element ref from snapshot"),
      selector: z.string().min(1).optional().describe("CSS selector"),
      text: z.string().describe("Text to type"),
      key: z.string().min(1).default("Enter").describe("Key to press after typing (default: Enter)")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            ref: z.string().min(1).optional().describe("Element ref from snapshot"),
            selector: z.string().min(1).optional().describe("CSS selector"),
            text: z.string().describe("Text to type"),
            key: z.string().min(1).default("Enter").describe("Key to press after typing (default: Enter)")
          })
          .refine((data) => Boolean(data.ref || data.selector), {
            message: "Either 'ref' or 'selector' is required"
          })
          .parse(input);

        const tracked = getTrackedTab(parsed.tabId);
        await deps.client.typeText(parsed.tabId, { ref: parsed.ref, selector: parsed.selector }, parsed.text, tracked.userId);
        await deps.client.pressKey(parsed.tabId, parsed.key, tracked.userId);
        incrementToolCall(parsed.tabId);

        return okResult({ typed: true, keyPressed: parsed.key });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "navigate_and_snapshot",
    "Navigate to a URL and return the page snapshot. Combines navigate + wait + snapshot into one call.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      url: z.string().url().describe("Full URL to navigate to"),
      waitForText: z.string().optional().describe("Optional text to wait for before taking snapshot"),
      timeout: z.number().positive().optional().default(10000).describe("Wait timeout in ms")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            url: z.string().url().describe("Full URL to navigate to"),
            waitForText: z.string().optional().describe("Optional text to wait for before taking snapshot"),
            timeout: z.number().positive().optional().default(10000).describe("Wait timeout in ms")
          })
          .parse(input);

        const tracked = getTrackedTab(parsed.tabId);
        const navigation = await deps.client.navigate(parsed.tabId, parsed.url, tracked.userId);
        await deps.client.waitForReady(parsed.tabId, tracked.userId, parsed.timeout);

        if (parsed.waitForText) {
          await deps.client.waitForText(parsed.tabId, tracked.userId, parsed.waitForText, parsed.timeout);
        }

        const snap = await deps.client.snapshot(parsed.tabId, tracked.userId);
        incrementToolCall(parsed.tabId);
        updateTabUrl(parsed.tabId, snap.url || navigation.url);
        updateRefsCount(parsed.tabId, snap.refsCount);

        return okResult({
          url: snap.url || navigation.url,
          title: navigation.title ?? "",
          snapshot: snap.snapshot,
          refsCount: snap.refsCount
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "scroll_and_snapshot",
    "Scroll the page and take a snapshot. Useful for revealing content below the fold.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      direction: z.enum(["up", "down"]).describe("Scroll direction"),
      amount: z.number().positive().default(500).describe("Pixels to scroll"),
      waitMs: z.number().nonnegative().optional().default(500).describe("Milliseconds to wait after scrolling before snapshot")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            direction: z.enum(["up", "down"]).describe("Scroll direction"),
            amount: z.number().positive().default(500).describe("Pixels to scroll"),
            waitMs: z.number().nonnegative().optional().default(500).describe("Milliseconds to wait after scrolling before snapshot")
          })
          .parse(input);

        const tracked = getTrackedTab(parsed.tabId);
        await deps.client.scroll(parsed.tabId, parsed.direction, parsed.amount, tracked.userId);

        if (parsed.waitMs > 0) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, parsed.waitMs);
          });
        }

        const snap = await deps.client.snapshot(parsed.tabId, tracked.userId);
        incrementToolCall(parsed.tabId);
        updateTabUrl(parsed.tabId, snap.url);
        updateRefsCount(parsed.tabId, snap.refsCount);

        return okResult({
          scrolled: {
            direction: parsed.direction,
            amount: parsed.amount
          },
          snapshot: snap.snapshot,
          refsCount: snap.refsCount
        });
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "batch_click",
    "Click multiple elements sequentially. Continues on error (clicks are independent). Returns per-click results.",
    {
      tabId: z.string().min(1).describe("Tab ID from create_tab"),
      clicks: z.array(clickSchema).min(1).max(10).describe("Array of elements to click"),
      delayMs: z.number().nonnegative().optional().default(200).describe("Delay between clicks in ms")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            tabId: z.string().min(1).describe("Tab ID from create_tab"),
            clicks: z.array(clickSchema).min(1).max(10).describe("Array of elements to click"),
            delayMs: z.number().nonnegative().optional().default(200).describe("Delay between clicks in ms")
          })
          .parse(input);

        const tracked = getTrackedTab(parsed.tabId);
        const results: Array<{ index: number; ref?: string; selector?: string; success: boolean; error?: string }> = [];

        for (let index = 0; index < parsed.clicks.length; index += 1) {
          const click = parsed.clicks[index];
          try {
            await deps.client.click(parsed.tabId, { ref: click.ref, selector: click.selector }, tracked.userId);
            results.push({ index, ref: click.ref, selector: click.selector, success: true });
          } catch (error) {
            const appError = normalizeError(error);
            results.push({ index, ref: click.ref, selector: click.selector, success: false, error: appError.message });
          }

          if (index < parsed.clicks.length - 1 && parsed.delayMs > 0) {
            await new Promise<void>((resolve) => {
              setTimeout(resolve, parsed.delayMs);
            });
          }
        }

        const clicked = results.filter((result) => result.success).length;
        incrementToolCall(parsed.tabId);

        return jsonResult(
          {
            success: clicked === parsed.clicks.length,
            clicked,
            total: parsed.clicks.length,
            results
          },
          clicked < parsed.clicks.length
        );
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );
}
