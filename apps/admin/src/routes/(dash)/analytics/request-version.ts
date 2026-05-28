export interface LatestRequestVersion {
	next(): number;
	isCurrent(token: number): boolean;
}

export function createLatestRequestVersion(): LatestRequestVersion {
	let current = 0;

	return {
		next() {
			current += 1;
			return current;
		},
		isCurrent(token) {
			return token === current;
		}
	};
}
