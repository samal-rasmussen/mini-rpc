import type { z } from 'zod';

export type Types = 'get' | 'set' | 'subscribe';
export type MessageTypes = Types | 'unsubscribe';

/**
 * Given a URL-like string with :params (eg. `/thing/:thingId`), returns a type
 * with the params as keys (eg. `{ thingId: string }`).
 */
export type ResourceParams<T> =
	T extends `${infer _Start}:${infer Param}/${infer Rest}` // eslint-disable-line @typescript-eslint/no-unused-vars
		? { [k in Param | keyof ResourceParams<Rest>]: string | number }
		: T extends `${infer _Start}:${infer Param}` // eslint-disable-line @typescript-eslint/no-unused-vars
		? { [k in Param]: string | number }
		: null | undefined;

type AnyResource = {
	response: z.ZodTypeAny;
	type: 'get' | 'subscribe' | 'get|subscribe';
};
export type AnySettableResource = {
	request: z.ZodTypeAny;
	response: z.ZodTypeAny;
	type: 'set' | 'get|set' | 'set|subscribe' | 'get|set|subscribe';
};
export type AnyResources = {
	[key: string]: AnyResource | AnySettableResource;
};
export type AnySettableResources = {
	[key: string]: AnySettableResource;
};

export interface Observer<T> {
	next: (value: T) => void;
	error: (err: any) => void;
	complete: () => void;
}

export interface Unsubscribable {
	unsubscribe(): void;
}

export interface Subscribable<T> {
	subscribe(observer: Partial<Observer<T>>): Unsubscribable;
}

export type Result<
	Resources extends AnyResources,
	Resource extends keyof Resources,
> = z.infer<Resources[Resource]['response']>;
