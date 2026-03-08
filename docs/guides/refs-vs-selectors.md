# Refs vs CSS Selectors - When to Use What

## Overview

CamoFox MCP supports two ways to target elements:

- **Refs** are short IDs like `e5` that come from the page accessibility snapshot returned by `snapshot`.
- **CSS selectors** target elements directly in the live DOM, such as `input[name="q"]` or `button[type="submit"]`.

Use refs first when they are available. They are faster to discover, easier for agents to reason about, and usually the most reliable way to interact with standard buttons, links, inputs, and navigation controls. Use CSS selectors when the snapshot does not include the element you need, or when the page is heavily dynamic and the accessibility tree is incomplete.

In CamoFox MCP, the core rule is simple: **start with `snapshot`, then fall back to `camofox_get_page_html`, `camofox_query_selector`, and `camofox_wait_for_selector` only when refs are missing or stale**.

## Decision Tree

```text
Need to interact with an element?
├── Take a snapshot first (`snapshot`)
├── Element has a ref (e1, e2, etc.)?
│   ├── YES -> Use the ref (example: click e5)
│   └── NO -> Use CSS selector tools or `camofox_get_page_html`
└── Snapshot didn't return the element?
    └── Use `camofox_get_page_html` + `camofox_query_selector` + `camofox_wait_for_selector`
```

## How Refs Work

Refs are generated from the accessibility tree, not from raw HTML. Under the hood, CamoFox Browser uses Playwright `ariaSnapshot()` to read the page and then assigns sequential ref IDs to supported interactive elements.

- **Format:** `e1`, `e2`, `e3`, and so on
- **Source:** accessibility tree from Playwright `ariaSnapshot()`
- **Assignment rule:** sequential integer IDs in snapshot order
- **Node limit:** maximum 2000 indexed nodes per snapshot by default
- **Configuration:** set `CAMOFOX_MAX_SNAPSHOT_NODES` to raise or lower that limit
- **Lifetime:** refs reset after navigation and may become stale after significant DOM changes

Only interactable elements get refs. In the current implementation, CamoFox indexes these 19 ARIA roles:

- `button`
- `link`
- `textbox`
- `checkbox`
- `radio`
- `menuitem`
- `tab`
- `searchbox`
- `slider`
- `spinbutton`
- `switch`
- `combobox`
- `listbox`
- `option`
- `select`
- `dialog`
- `alertdialog`
- `gridcell`
- `treeitem`

This means refs are intentionally selective. They are designed for actionable elements, not for every `div`, `span`, or custom widget in the page.

### Why Refs Are Useful

- They are compact and token-efficient.
- They make snapshots easy to read.
- They avoid brittle long selectors on well-structured sites.
- They let you interact with the same element you just saw in the snapshot.

### Important Ref Rules

- Always call `snapshot` before trying to use refs.
- After any navigation, call `snapshot` again.
- After a major DOM update, re-snapshot if an old ref stops working.
- If the element is not in the snapshot, do not guess the ref. Switch to the CSS selector workflow.

## When Refs Work Well

Refs work best on sites with strong ARIA semantics and standard HTML controls.

- Well-structured sites with proper accessibility roles
- Standard forms, login pages, search boxes, nav menus, tabs, and buttons
- Pages where the snapshot clearly shows the target element and its label

Real-world coverage from testing:

| Site | Total Elements | With Refs | Coverage |
|------|----------------|-----------|----------|
| example.com | ~5 | 1 | 20% |
| google.com | ~27 | 24 | 74% |
| react.dev | ~200+ | 105 | ~50% |
| github.com | ~200+ | 106 | high |
| amazon.com | ~500+ | 355 | good |

That pattern is typical:

- On semantic, accessible sites, refs cover a large share of useful controls.
- On simple static pages, only a few elements may get refs.
- On large modern apps, refs often cover the important controls, but not everything.

## When Refs Fail

Refs are not a full DOM mirror. They fail when the accessibility tree does not expose the element you need.

Common failure cases:

- Custom `<div onclick>` elements with no ARIA attributes
- Web Components and shadow DOM content that does not surface cleanly in the accessibility tree
- Dynamically loaded content that has not rendered yet
- Elements with no semantic role
- Highly reactive SPAs where the DOM changed after the snapshot

In those cases, the page may still be fully interactable, but you must switch to the DOM-oriented CSS selector workflow.

## Ref-First Approach

Use this approach whenever the element appears in `snapshot` with a ref.

### Example: Click a button by ref

```json
{
  "tool": "snapshot",
  "arguments": {
    "tabId": "tab_123"
  }
}
```

Example snapshot fragment:

```text
- textbox "Email" [e3]
- textbox "Password" [e4]
- button "Sign in" [e5]
```

```json
{
  "tool": "click",
  "arguments": {
    "tabId": "tab_123",
    "ref": "e5"
  }
}
```

### Example: Type into a search field by ref

```json
{
  "tool": "type_text",
  "arguments": {
    "tabId": "tab_123",
    "ref": "e8",
    "text": "playwright accessibility snapshot"
  }
}
```

If the snapshot already gave you `e8`, using the ref is the cleanest option.

## CSS Selector Approach

Use CSS selectors when the snapshot does not include the target element, when the element appears too late, or when you need DOM-specific inspection.

The standard workflow is:

1. Use `camofox_get_page_html` to inspect the rendered DOM.
2. Use `camofox_query_selector` to confirm the selector matches the right element.
3. Use `camofox_wait_for_selector` if the element loads asynchronously.
4. Interact with `click` or `type_text` using the selector directly.

### Example: Inspect the DOM

```json
{
  "tool": "camofox_get_page_html",
  "arguments": {
    "tabId": "tab_123",
    "selector": "form[role='search']"
  }
}
```

### Example: Confirm a selector

```json
{
  "tool": "camofox_query_selector",
  "arguments": {
    "tabId": "tab_123",
    "selector": "input[name='q']"
  }
}
```

### Example: Wait for dynamic content

```json
{
  "tool": "camofox_wait_for_selector",
  "arguments": {
    "tabId": "tab_123",
    "selector": "div.search-results",
    "timeout": 10000
  }
}
```

### Example: Type using a CSS selector

```json
{
  "tool": "type_text",
  "arguments": {
    "tabId": "tab_123",
    "selector": "input[name='q']",
    "text": "camofox mcp"
  }
}
```

### Example: Click using a CSS selector

```json
{
  "tool": "click",
  "arguments": {
    "tabId": "tab_123",
    "selector": "button[type='submit']"
  }
}
```

## Real-World Examples

### Google Search

Google is a mixed case: many elements have refs, but not all of them do.

- `e8` for the main search field is a good ref target when it appears as a `combobox` or `searchbox`
- Some top navigation items or dynamic controls may be easier to target with CSS selectors

Ref-first example:

```json
{
  "tool": "type_text",
  "arguments": {
    "tabId": "tab_google",
    "ref": "e8",
    "text": "camofox mcp github"
  }
}
```

Fallback example:

```json
{
  "tool": "click",
  "arguments": {
    "tabId": "tab_google",
    "selector": "a[href*='support.google.com']"
  }
}
```

### Amazon

Amazon generally has strong ref coverage for primary search and category controls.

- `e38` is a good example of a searchbox ref for `type_text`
- `e9` through `e37` are good examples of clickable department or menu options
- Some dropdown internals are still easier to inspect with `camofox_get_page_html` and target with CSS selectors

Ref examples:

```json
{
  "tool": "type_text",
  "arguments": {
    "tabId": "tab_amazon",
    "ref": "e38",
    "text": "usb c hub"
  }
}
```

```json
{
  "tool": "click",
  "arguments": {
    "tabId": "tab_amazon",
    "ref": "e12"
  }
}
```

Selector fallback example:

```json
{
  "tool": "camofox_get_page_html",
  "arguments": {
    "tabId": "tab_amazon",
    "selector": "#searchDropdownBox"
  }
}
```

### Example.com

This is the opposite extreme: the page is simple and mostly static, so only one obvious interactive element may receive a ref.

- Usually only the main link is assigned a ref
- For anything else, expect to use CSS selectors or just read the snapshot text

Example:

```json
{
  "tool": "click",
  "arguments": {
    "tabId": "tab_example",
    "ref": "e1"
  }
}
```

### GitHub

GitHub is one of the best examples of the ref system working well in practice.

- Roughly 106 refs on a typical high-density page
- Most navigation, buttons, links, dialogs, and text inputs are accessible by ref
- Refs are usually the best first choice unless you are targeting a very specific DOM-only element

Typical pattern:

```json
{
  "tool": "snapshot",
  "arguments": {
    "tabId": "tab_github"
  }
}
```

Then use the returned refs directly for search fields, repo links, buttons, tabs, or dialogs.

## Best Practice Workflow

```text
1. Navigate to the page
2. Take a snapshot
3. Look for the element in the snapshot
4. If found with a ref -> use the ref
5. If not found -> use camofox_get_page_html -> find a CSS selector -> use the selector
6. After any navigation -> take a new snapshot before interacting again
```

For SPAs and dynamic pages, add one more rule: if the target is supposed to exist but is missing, wait for it first.

Recommended dynamic-page workflow:

1. Navigate.
2. Call `snapshot`.
3. If the target is missing, call `camofox_wait_for_selector`.
4. Call `snapshot` again.
5. If the element now has a ref, use the ref.
6. If it still has no ref, interact using the CSS selector.

## Troubleshooting

### "Unknown ref: eN"

Cause: the ref expired, the page navigated, or the snapshot was never taken for the current page state.

Fix: call `snapshot` again and use the new ref.

### "Ref eN may be stale"

Cause: the DOM changed after the snapshot, often because of SPA re-rendering, search suggestions, modal updates, or infinite scrolling.

Fix: take a fresh snapshot and re-locate the element.

### Element is not in the snapshot

Cause: the element is not exposed through the accessibility tree, has not rendered yet, or has weak semantics.

Fix:

1. Try `camofox_wait_for_selector` if content may still be loading.
2. Use `camofox_get_page_html` to inspect the live DOM.
3. Use `camofox_query_selector` to confirm the selector.
4. Use `click` or `type_text` with `selector` instead of `ref`.

### Snapshot is incomplete on a large page

Cause: the snapshot reached its node or output limits.

Fix:

- Paginate large snapshots with the `offset` parameter when truncation metadata is returned.
- Increase `CAMOFOX_MAX_SNAPSHOT_NODES` if your browser-server deployment needs deeper indexing.
- Use CSS selector tools for highly specific targets instead of scanning the whole snapshot.

## Quick Rule of Thumb

- If `snapshot` shows the element with a ref, use the ref.
- If `snapshot` does not show it, use the CSS selector workflow.
- If a ref worked a moment ago but fails now, re-snapshot.
- If the page is a modern SPA or custom-component-heavy UI, expect to use both approaches together.

That is the intended model for CamoFox MCP: **refs first, selectors when needed, and a fresh snapshot whenever page state changes**.