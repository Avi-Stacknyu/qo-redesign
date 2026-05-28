import { getGlobalSchemas } from './global-schema.remote';

export async function load() {
	const schemas = await getGlobalSchemas();
	return { schemas };
}
