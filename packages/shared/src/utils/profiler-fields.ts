type ProfileField = { value?: unknown; label?: string };
type ProfileSection = { fields?: Record<string, ProfileField> };

export type ProfileSections = Record<string, ProfileSection>;

export const PROFILE_FIELD_ALIASES: Record<string, string[]> = {
  residence_country: ['country'],
  home_timezone: ['timezone'],
  home_city: ['city'],
  home_continent: ['continent'],
  profession: ['occupation', 'role'],
  investment_horizon: ['investment_timeline', 'time_horizon'],
  financial_goals: ['primary_financial_goals'],
  communication_style: ['communication_preference'],
  language_preference: ['language']
};

const aliasToCanonical = new Map<string, string>();

for (const [canonical, aliases] of Object.entries(PROFILE_FIELD_ALIASES)) {
  aliasToCanonical.set(canonical, canonical);
  for (const alias of aliases) aliasToCanonical.set(alias, canonical);
}

function canonicalKey(key: string): string {
  const normalized = key.trim().toLowerCase();
  return aliasToCanonical.get(normalized) ?? normalized;
}

function keysFor(key: string): string[] {
  const canonical = canonicalKey(key);
  return [canonical, ...(PROFILE_FIELD_ALIASES[canonical] ?? [])];
}

function fieldValue(field: ProfileField | undefined): string | null {
  if (field?.value == null) return null;
  const value = String(field.value).trim();
  return value.length > 0 ? value : null;
}

export function sameProfileField(left: string, right: string): boolean {
  return canonicalKey(left) === canonicalKey(right);
}

export function schemaKeyFor(fieldKey: string, schemaKeys: string[]): string {
  return schemaKeys.find((schemaKey) => sameProfileField(schemaKey, fieldKey)) ?? fieldKey.trim();
}

export function findProfileField(
  sections: ProfileSections,
  sectionId: string,
  fieldKey: string
): { sectionId: string; key: string; field: ProfileField; value: string } | null {
  const candidates = keysFor(fieldKey);

  const fields = sections[sectionId]?.fields ?? {};
  for (const candidateKey of candidates) {
    const entry = Object.entries(fields).find(([key]) => key.trim().toLowerCase() === candidateKey);
    if (!entry) continue;

    const value = fieldValue(entry[1]);
    if (value) return { sectionId, key: entry[0], field: entry[1], value };
  }

  return null;
}

export function canonicalizeProfileUpdates<TField extends { value: string; label?: string }>(
  updates: Array<{ section: string; fields: Record<string, TField> }>,
  schema: Array<{ section_id: string; fields: Array<{ key: string }> }>
): Array<{ section: string; fields: Record<string, TField> }> {
  return updates.map((update) => {
    const section = schema.find((item) => item.section_id === update.section);
    if (!section) return update;

    const schemaKeys = section.fields.map((field) => field.key);
    const fields: Record<string, TField> = {};

    for (const [fieldKey, value] of Object.entries(update.fields)) {
      fields[schemaKeyFor(fieldKey, schemaKeys)] ??= value;
    }

    return { ...update, fields };
  });
}
