import { z } from 'zod';

export type Types = 'get' | 'set' | 'subscribe';
export type MessageTypes = Types | 'unsubscribe';

/**
 * Given a URL-like string with :params (eg. `/thing/:thingId`), returns a type
 * with the params as keys (eg. `{ thingId: string }`).
 */
export type ResourceParams<T> =
	T extends `${infer _Start}:${infer Param}/${infer Rest}` // eslint-disable-line @typescript-eslint/no-unused-vars
		? { [k in Param | keyof ResourceParams<Rest>]: string }
		: T extends `${infer _Start}:${infer Param}` // eslint-disable-line @typescript-eslint/no-unused-vars
		? { [k in Param]: string }
		: unknown;

type AnyResource = {
	request: z.AnyZodObject;
	response: z.AnyZodObject;
	type:
		| 'get'
		| 'set'
		| 'subscribe'
		| 'get|set'
		| 'get|subscribe'
		| 'set|subscribe'
		| 'get|set|subscribe';
};
type AnyResources = {
	[key: string]: AnyResource;
};

export const resources = {
	'/resourceA': {
		request: z.NEVER,
		response: z.object({ name: z.string() }),
		type: 'get',
	},
	'/resourceB/:id': {
		request: z.object({ name: z.string() }),
		response: z.object({ name: z.string() }),
		type: 'get|set|subscribe',
	},
} as const satisfies AnyResources;
export type Resources = typeof resources;

interface Observer<T> {
	next: (value: T) => void;
	error: (err: any) => void;
	complete: () => void;
}

interface Unsubscribable {
	unsubscribe(): void;
}

export interface Subscribable<T> {
	subscribe(observer: Partial<Observer<T>>): Unsubscribable;
}
