export const STRICT_ONBOARDING_TEMPLATE = `# Founder Liquidity Intake

## Profile
- key: founder-liquidity
- description: Intake for founders preparing for a liquidity event.
- industry_key: venture
- status: draft
- visibility: invite_only
- default_tags: industry:venture, journey:liquidity
- runtime_model:
- max_ai_questions: 5
- session_timeout_ms: 1800000
- cache_ttl_ms: 3600000
- enable_trial_activation: true

## Disclosures
- enabled: true

### Data usage acknowledgement
- id: disclosure_data_usage
- question: I acknowledge that my onboarding answers may be used to personalise my experience and route me to the right support.
- type: acknowledgement
- required: true

### Data Processing Agreement
- id: disclosure_data_processing_agreement
- title: Data Processing Agreement
- question: I agree to the data processing agreement.
- body: We collect and process personal data to personalise your onboarding experience. By proceeding you consent to our data processing practices.
- type: accept_deny
- required: true
- accept_label: I Agree
- reject_label: Decline
- reject_message: You must accept the data processing agreement to continue onboarding.

## Prompt
You are onboarding a founder preparing for a liquidity event. Ask concise follow-up questions only when they help clarify goals, ownership structure, timing, and constraints. Do not repeat disclosure text as normal onboarding questions.

## Questions
### Current role
- question: What best describes your role right now?
- type: single_select
- fact_key: user_role
- required: true
- enabled: true
- group: Basics
- options: Founder | founder | role:founder; Operator | operator | role:operator; Investor | investor | role:investor

### Planning goals
- question: Which outcomes matter most right now?
- type: multi_select
- fact_key: planning_goals
- required: true
- enabled: true
- group: Goals
- description: Capture the planning priorities that should shape the onboarding path.
- options: Exit planning | exit | goal:exit; Liquidity planning | liquidity | goal:liquidity; Tax planning | tax | goal:tax

### Exit timing
- question: What is your expected liquidity timeline?
- type: text
- fact_key: exit_timeline
- required: false
- enabled: true
- description: Capture the expected window for a sale or secondary event.
- sidebar_title: Liquidity timing
- group: Liquidity
- show_when_all: user_role equals founder; planning_goals includes_any exit, liquidity
- show_when_any: planning_goals includes tax; planning_goals includes exit

## AI Fallback Questions
### Clarifying support need
- id: fallback_support_need
- question: What support would be most useful if we need one more detail from you?
- type: single_select
- fact_key: fallback_support_need
- fact_label: Support Need
- sidebar_title: Support Need
- required: true
- options: Planning help | planning; Priority clarification | priorities; Practical next steps | next_steps
`;

export const ONBOARDING_PROFILE_AGENT_INSTRUCTIONS = `# Quant Orion Onboarding Profile Agent Instructions

Use this when asking ChatGPT, Claude, Gemini, or another external agent to generate a Quant Orion onboarding profile.

Return only markdown. Do not return JSON. Do not wrap the result in code fences. Do not add commentary before or after the markdown.

## Required Structure

1. The first line must be a single H1 with the profile name.
2. Include these H2 sections in this order:
   - Profile
   - Disclosures (optional)
   - Prompt
   - Questions
   - AI Fallback Questions (optional)
3. Each question must be an H3 under Questions.
4. Each disclosure item must be an H3 under Disclosures.
5. Each fallback question must be an H3 under AI Fallback Questions.
6. Question order is determined by the order of the H3 blocks.

## Profile Keys

Use bullet lines in the Profile section with lowercase snake_case keys.

- key: stable profile key used for round-trip import/update
- description: one concise sentence
- industry_key: industry or segment key
- status: draft, active, or archived
- visibility: public, invite_only, or hidden
- default_tags: comma-separated namespace:value tags assigned on completion
- runtime_model: leave blank if the exact Quant Orion runtime model id is unknown
- max_ai_questions: integer from 0 to 20
- session_timeout_ms: optional integer timeout in milliseconds
- cache_ttl_ms: optional integer cache ttl in milliseconds
- enable_trial_activation: true or false

## Disclosures Section (Optional)

Add a \`## Disclosures\` section when the user must see disclosure items before normal onboarding questions.

Start the section with:

- enabled: true or false

Each disclosure item is an H3 block with these keys:

- id: stable disclosure id
- question: exact acknowledgement or agreement statement shown to the user
- title: optional heading for long-form disclosures
- body: optional detailed disclosure copy
- type: acknowledgement or accept_deny
- required: true or false
- accept_label: optional custom label for the accept action
- reject_label: optional custom label for the reject action
- reject_message: optional message shown when a required disclosure is declined

Rules:

- use \`acknowledgement\` when the user only confirms they read the statement
- use \`accept_deny\` when a refusal should block onboarding
- use a disclosure item with title/body fields for long-form consent or terms text
- keep the core agreement statement in \`question\`, even when \`title\` and \`body\` are present
- do not repeat disclosures as normal onboarding questions

## Prompt Section

The Prompt section becomes the runtime AI onboarding prompt. It should explain:

- who the onboarding is for
- what information matters
- tone and follow-up boundaries
- what should not be asked unless necessary
- that disclosures are not part of the normal Q&A flow

## Question Keys

Each H3 question block can use these bullet keys:

- question: the user-facing question text
- type: single_select, multi_select, text, number, or boolean
- fact_key: snake_case storage key
- required: true or false
- enabled: true or false
- description: optional internal hint about the field
- sidebar_title: optional shorter UI label
- group: optional section/group label in the editor
- options: required for single_select and multi_select
- show_when: optional single condition
- show_when_all: optional semicolon-separated list of conditions that must all pass
- show_when_any: optional semicolon-separated list of conditions where any pass is enough

## Option Format

For single_select and multi_select questions, write options on one line like this:

Label A | value_a | namespace:tag namespace:tag; Label B | value_b | namespace:tag

Rules:

- label is human-readable
- value must be snake_case or slug-like and stable
- the third segment is optional
- tags in the third segment are granted only when that option is selected

## Conditional Logic Format

Supported operators:

- equals
- not_equals
- includes
- includes_any
- exists
- not_exists

Formats:

- Single condition:
  - show_when: user_role equals founder
- All conditions required:
  - show_when_all: user_role equals founder; planning_goals includes_any exit, liquidity
- Any condition accepted:
  - show_when_any: planning_goals includes exit; planning_goals includes tax

Rules:

- use fact_key names in conditions
- use comma-separated values for includes_any
- exists and not_exists should not include a value
- show_when, show_when_all, and show_when_any can be combined

## AI Fallback Questions Section (Optional)

Add a \`## AI Fallback Questions\` section when this profile needs domain-specific backup questions if live AI generation fails.

Use the same H3 block format as normal questions, except conditional logic is ignored. Each fallback should be broad enough to fit the profile and specific enough to avoid generic cross-domain questions.

Supported keys:

- id
- question
- type
- fact_key
- fact_label
- sidebar_title
- required
- description
- group
- options

## Authoring Rules

- fact_key values must be snake_case
- key should be stable across revisions so importing the same markdown can update the existing profile
- visibility must be public, invite_only, or hidden
- status must be draft, active, or archived
- default_tags and option tags must use namespace:value format
- single_select and multi_select should include options
- text, number, and boolean should usually not include options
- do not invent Quant Orion model ids; leave runtime_model blank if unknown
- do not output placeholder explanations like "fill this later"
- avoid questions that duplicate each other
- keep questions specific and operational

## Output Example

${STRICT_ONBOARDING_TEMPLATE}
`;
