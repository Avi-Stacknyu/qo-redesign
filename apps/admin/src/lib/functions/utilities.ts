import { goto } from '$app/navigation';
import { page } from '$app/state';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatErrorMessages(response: any) {
	const formattedErrors = [];
	// Check if the response and data objects are present
	if (response && response.response && response.response.data) {
		const data = response.response.data;

		// Start with the main error message
		if (response.response.message) {
			formattedErrors.push(`Error: ${response.response.message}`);
		}

		// Iterate over the data object properties to append individual error messages
		for (const [key, value] of Object.entries(data)) {
			// Handle nested error objects
			// @ts-expect-error - value is not typed
			if (typeof value === 'object' && value !== null && value.message) {
				formattedErrors.push(
					// @ts-expect-error - value is not typed
					`${capitalizeFirstLetter(key.replace('_', ' '))}: ${value.message}`
				);
			} else {
				// Fallback for non-object or unexpected error formats
				formattedErrors.push(`${capitalizeFirstLetter(key.replace('_', ' '))}: ${value}`);
			}
		}
	}

	// Join all errors into a single string with new lines for readability
	return formattedErrors.join('\n');
}

function capitalizeFirstLetter(s: string) {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function addSearchParam(id: string, params: Record<string, string>) {
	const currentPageUrl = page.url;
	const searchParams = new URLSearchParams(currentPageUrl.search);

	Object.entries(params).forEach(([key, value]) => {
		const paramKey = `${id}_${key}`;
		// Clear the param if value is empty
		if (value === '' || value === null || value === undefined) {
			searchParams.delete(paramKey);
		} else {
			searchParams.set(paramKey, value);
		}
	});

	const newUrl = `${currentPageUrl.pathname}?${searchParams}`;

	await goto(newUrl, {
		replaceState: true,
		invalidateAll: false,
		keepFocus: true,
		noScroll: true
	});
}

export const convertToNormalCase = (str: string) =>
	str
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
