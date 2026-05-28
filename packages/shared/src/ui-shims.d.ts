/**
 * Ambient type declarations for `$ui/*` Shadcn component imports.
 *
 * At build time, each consuming SvelteKit app maps `$ui` to its own local
 * Shadcn installation (via `kit.alias` in svelte.config.js).  These ambient
 * declarations allow the shared package to pass svelte-check on its own.
 */

declare module '$ui/card' {
  const Root: typeof import('svelte').SvelteComponent;
  const Header: typeof import('svelte').SvelteComponent;
  const Title: typeof import('svelte').SvelteComponent;
  const Description: typeof import('svelte').SvelteComponent;
  const Content: typeof import('svelte').SvelteComponent;
  const Footer: typeof import('svelte').SvelteComponent;
  const Action: typeof import('svelte').SvelteComponent;
  export { Root, Header, Title, Description, Content, Footer, Action };
}

declare module '$ui/chart' {
  export type ChartConfig = Record<string, { label?: string; color?: string }>;
  const Container: typeof import('svelte').SvelteComponent;
  const Tooltip: typeof import('svelte').SvelteComponent;
  const Legend: typeof import('svelte').SvelteComponent;
  const Style: typeof import('svelte').SvelteComponent;
  export { Container, Tooltip, Legend, Style };
}

declare module '$ui/table' {
  const Root: typeof import('svelte').SvelteComponent;
  const Header: typeof import('svelte').SvelteComponent;
  const Head: typeof import('svelte').SvelteComponent;
  const Body: typeof import('svelte').SvelteComponent;
  const Row: typeof import('svelte').SvelteComponent;
  const Cell: typeof import('svelte').SvelteComponent;
  export { Root, Header, Head, Body, Row, Cell };
}

declare module '$ui/alert-dialog' {
  const Root: typeof import('svelte').SvelteComponent;
  const Trigger: typeof import('svelte').SvelteComponent;
  const Content: typeof import('svelte').SvelteComponent;
  const Header: typeof import('svelte').SvelteComponent;
  const Title: typeof import('svelte').SvelteComponent;
  const Description: typeof import('svelte').SvelteComponent;
  const Footer: typeof import('svelte').SvelteComponent;
  const Action: typeof import('svelte').SvelteComponent;
  const Cancel: typeof import('svelte').SvelteComponent;
  export { Root, Trigger, Content, Header, Title, Description, Footer, Action, Cancel };
}

declare module '$ui/badge' {
  export const Badge: typeof import('svelte').SvelteComponent;
}

declare module '$ui/input' {
  export const Input: typeof import('svelte').SvelteComponent;
}

declare module '$ui/button' {
  export const Button: typeof import('svelte').SvelteComponent;
}

declare module '$ui/select' {
  const Root: typeof import('svelte').SvelteComponent;
  const Trigger: typeof import('svelte').SvelteComponent;
  const Value: typeof import('svelte').SvelteComponent;
  const Content: typeof import('svelte').SvelteComponent;
  const Item: typeof import('svelte').SvelteComponent;
  export { Root, Trigger, Value, Content, Item };
}

declare module '$ui/skeleton' {
  export const Skeleton: typeof import('svelte').SvelteComponent;
}
