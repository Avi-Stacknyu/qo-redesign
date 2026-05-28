<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import { StarterKit } from '@tiptap/starter-kit';
	import { Placeholder } from '@tiptap/extension-placeholder';
	import { Typography } from '@tiptap/extension-typography';
	import { Underline } from '@tiptap/extension-underline';
	import { Link } from '@tiptap/extension-link';
	import { TaskList } from '@tiptap/extension-task-list';
	import { TaskItem } from '@tiptap/extension-task-item';
	import { Highlight } from '@tiptap/extension-highlight';
	import { Markdown } from 'tiptap-markdown';
	import {
		Bold,
		Italic,
		Underline as UnderlineIcon,
		Strikethrough,
		Heading1,
		Heading2,
		Heading3,
		List,
		ListOrdered,
		ListTodo,
		Quote,
		Code,
		Minus,
		Link as LinkIcon,
		Highlighter,
		Undo2,
		Redo2
	} from '@lucide/svelte';
	import { Separator } from '$lib/components/shadcn/separator/index.js';

	let {
		content = '',
		onupdate,
		editable = true
	}: {
		content?: string;
		onupdate?: (markdown: string) => void;
		editable?: boolean;
	} = $props();

	let element = $state<HTMLDivElement>();
	let editorState = $state<{ editor: Editor | null }>({ editor: null });
	type MarkdownStorage = { markdown?: { getMarkdown?: () => string } };

	onMount(() => {
		editorState.editor = new Editor({
			element: element!,
			editable,
			extensions: [
				StarterKit.configure({
					heading: { levels: [1, 2, 3] },
					codeBlock: { HTMLAttributes: { class: 'rounded-lg bg-muted/60 p-4 font-mono text-sm' } }
				}),
				Placeholder.configure({
					placeholder: 'Start writing...',
					emptyEditorClass: 'is-editor-empty'
				}),
				Typography,
				Underline,
				Link.configure({
					openOnClick: false,
					HTMLAttributes: { class: 'text-primary underline decoration-primary/40 cursor-pointer' }
				}),
				TaskList,
				TaskItem.configure({ nested: true }),
				Highlight.configure({ multicolor: false }),
				Markdown.configure({
					html: true,
					transformPastedText: true,
					transformCopiedText: true
				})
			],
			content,
			onTransaction: ({ editor }) => {
				editorState = { editor };
			},
			onUpdate: ({ editor }) => {
				const markdownStorage = editor.storage as MarkdownStorage;
				onupdate?.(markdownStorage.markdown?.getMarkdown?.() ?? editor.getText());
			}
		});
	});

	onDestroy(() => {
		editorState.editor?.destroy();
	});

	function setLink() {
		const editor = editorState.editor;
		if (!editor) return;

		const previousUrl = editor.getAttributes('link').href;
		const url = window.prompt('URL', previousUrl);
		if (url === null) return;
		if (url === '') {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}
		editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
	}

	type ToolbarItem =
		| {
				type: 'button';
				icon: typeof Bold;
				label: string;
				action: () => void;
				isActive?: () => boolean;
		  }
		| { type: 'separator' };

	let toolbar = $derived.by((): ToolbarItem[] => {
		const e = editorState.editor;
		if (!e) return [];
		return [
			{
				type: 'button',
				icon: Bold,
				label: 'Bold',
				action: () => e.chain().focus().toggleBold().run(),
				isActive: () => e.isActive('bold')
			},
			{
				type: 'button',
				icon: Italic,
				label: 'Italic',
				action: () => e.chain().focus().toggleItalic().run(),
				isActive: () => e.isActive('italic')
			},
			{
				type: 'button',
				icon: UnderlineIcon,
				label: 'Underline',
				action: () => e.chain().focus().toggleUnderline().run(),
				isActive: () => e.isActive('underline')
			},
			{
				type: 'button',
				icon: Strikethrough,
				label: 'Strikethrough',
				action: () => e.chain().focus().toggleStrike().run(),
				isActive: () => e.isActive('strike')
			},
			{
				type: 'button',
				icon: Highlighter,
				label: 'Highlight',
				action: () => e.chain().focus().toggleHighlight().run(),
				isActive: () => e.isActive('highlight')
			},
			{ type: 'separator' },
			{
				type: 'button',
				icon: Heading1,
				label: 'Heading 1',
				action: () => e.chain().focus().toggleHeading({ level: 1 }).run(),
				isActive: () => e.isActive('heading', { level: 1 })
			},
			{
				type: 'button',
				icon: Heading2,
				label: 'Heading 2',
				action: () => e.chain().focus().toggleHeading({ level: 2 }).run(),
				isActive: () => e.isActive('heading', { level: 2 })
			},
			{
				type: 'button',
				icon: Heading3,
				label: 'Heading 3',
				action: () => e.chain().focus().toggleHeading({ level: 3 }).run(),
				isActive: () => e.isActive('heading', { level: 3 })
			},
			{ type: 'separator' },
			{
				type: 'button',
				icon: List,
				label: 'Bullet List',
				action: () => e.chain().focus().toggleBulletList().run(),
				isActive: () => e.isActive('bulletList')
			},
			{
				type: 'button',
				icon: ListOrdered,
				label: 'Ordered List',
				action: () => e.chain().focus().toggleOrderedList().run(),
				isActive: () => e.isActive('orderedList')
			},
			{
				type: 'button',
				icon: ListTodo,
				label: 'Task List',
				action: () => e.chain().focus().toggleTaskList().run(),
				isActive: () => e.isActive('taskList')
			},
			{ type: 'separator' },
			{
				type: 'button',
				icon: Quote,
				label: 'Block Quote',
				action: () => e.chain().focus().toggleBlockquote().run(),
				isActive: () => e.isActive('blockquote')
			},
			{
				type: 'button',
				icon: Code,
				label: 'Code Block',
				action: () => e.chain().focus().toggleCodeBlock().run(),
				isActive: () => e.isActive('codeBlock')
			},
			{
				type: 'button',
				icon: Minus,
				label: 'Divider',
				action: () => e.chain().focus().setHorizontalRule().run()
			},
			{
				type: 'button',
				icon: LinkIcon,
				label: 'Link',
				action: setLink,
				isActive: () => e.isActive('link')
			},
			{ type: 'separator' },
			{ type: 'button', icon: Undo2, label: 'Undo', action: () => e.chain().focus().undo().run() },
			{ type: 'button', icon: Redo2, label: 'Redo', action: () => e.chain().focus().redo().run() }
		];
	});
</script>

<div
	class="flex flex-col overflow-hidden rounded-xl border border-border/40 bg-card/90 backdrop-blur"
>
	<!-- Toolbar -->
	{#if editable && editorState.editor}
		<div class="flex flex-wrap items-center gap-0.5 border-b border-border/30 px-2 py-1.5">
			{#each toolbar as item, index (item.type === 'separator' ? `separator-${index}` : item.label)}
				{#if item.type === 'separator'}
					<Separator orientation="vertical" class="mx-1 h-5" />
				{:else}
					{@const Icon = item.icon}
					<button
						type="button"
						onclick={item.action}
						class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground {item.isActive?.()
							? 'bg-accent text-foreground'
							: ''}"
						title={item.label}
						aria-label={item.label}
					>
						<Icon class="size-3.5" />
					</button>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Editor -->
	<div
		bind:this={element}
		class="tiptap-editor prose prose-sm max-w-none flex-1 overflow-y-auto px-6 py-4 focus-within:outline-none dark:prose-invert"
	></div>
</div>

<style>
	:global(.tiptap-editor .tiptap) {
		outline: none;
		min-height: 300px;
	}

	:global(.tiptap-editor .tiptap p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
		color: oklch(0.6 0 0 / 0.5);
	}

	:global(.tiptap-editor .tiptap h1) {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.2;
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
	}

	:global(.tiptap-editor .tiptap h2) {
		font-size: 1.35rem;
		font-weight: 600;
		line-height: 1.3;
		margin-top: 1.25rem;
		margin-bottom: 0.4rem;
	}

	:global(.tiptap-editor .tiptap h3) {
		font-size: 1.1rem;
		font-weight: 600;
		line-height: 1.4;
		margin-top: 1rem;
		margin-bottom: 0.3rem;
	}

	:global(.tiptap-editor .tiptap ul[data-type='taskList']) {
		list-style: none;
		padding-left: 0;
	}

	:global(.tiptap-editor .tiptap ul[data-type='taskList'] li) {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		column-gap: 0.5rem;
	}

	:global(.tiptap-editor .tiptap ul[data-type='taskList'] li label) {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-top: 0.2rem;
		line-height: 1;
	}

	:global(.tiptap-editor .tiptap ul[data-type='taskList'] li label input[type='checkbox']) {
		margin: 0;
		cursor: pointer;
		accent-color: var(--primary);
	}

	:global(.tiptap-editor .tiptap ul[data-type='taskList'] li > div) {
		min-width: 0;
	}

	:global(.tiptap-editor .tiptap ul[data-type='taskList'] li > div > p) {
		margin: 0;
	}

	:global(.tiptap-editor .tiptap ul[data-type='taskList'] li[data-checked='true'] > div > p) {
		text-decoration: line-through;
		opacity: 0.6;
	}

	:global(.tiptap-editor .tiptap blockquote) {
		border-left: 3px solid var(--border);
		padding-left: 1rem;
		margin-left: 0;
		color: var(--muted-foreground);
		font-style: italic;
	}

	:global(.tiptap-editor .tiptap mark) {
		background-color: oklch(0.9 0.1 90 / 0.4);
		border-radius: 0.15rem;
		padding: 0.05rem 0.15rem;
	}

	:global(.tiptap-editor .tiptap hr) {
		border: none;
		border-top: 1px solid color-mix(in oklch, var(--border) 40%, transparent);
		margin: 1.5rem 0;
	}

	:global(.tiptap-editor .tiptap code) {
		background-color: color-mix(in oklch, var(--muted) 60%, transparent);
		border-radius: 0.25rem;
		padding: 0.15rem 0.3rem;
		font-size: 0.85em;
	}

	:global(.tiptap-editor .tiptap a) {
		color: var(--primary);
		text-decoration: underline;
	}
</style>
