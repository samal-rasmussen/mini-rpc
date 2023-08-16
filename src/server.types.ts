import type { z } from 'zod';
import type {
	AnyResources,
	AnySettableResource,
	ResourceParams,
	Subscribable,
} from './types.ts';
import { Request } from './message.types.ts';

export type GetHandler<
	Resources extends AnyResources,
	Resource extends keyof AnyResources,
> = (args: {
	clientId: number;
	resource: Resource;
}) => Promise<z.infer<Resources[Resource]['response']>>;

export type GetHandlerWithParams<
	Resources extends AnyResources,
	Resource extends keyof AnyResources,
> = (args: {
	clientId: number;
	params: ResourceParams<Resource>;
	resourceWithParams: string;
	resource: Resource;
}) => Promise<z.infer<Resources[Resource]['response']>>;

export type PickGetHandler<
	Resources extends AnyResources,
	Resource extends keyof AnyResources,
> = ResourceParams<Resource> extends null
	? GetHandler<Resources, Resource>
	: GetHandlerWithParams<Resources, Resource>;

export type SetHandler<
	Resources extends AnyResources,
	Resource extends keyof AnyResources,
	Request extends AnySettableResource['request'],
> = (args: {
	clientId: number;
	resource: Resource;
	request: z.infer<Request>;
}) => Promise<z.infer<Resources[Resource]['response']>>;

export type SetHandlerWithParams<
	Resources extends AnyResources,
	Resource extends keyof AnyResources,
	Request extends AnySettableResource['request'],
> = (args: {
	clientId: number;
	params: ResourceParams<Resource>;
	resourceWithParams: string;
	resource: Resource;
	request: z.infer<Request>;
}) => Promise<z.infer<Resources[Resource]['response']>>;

export type PickSetHandler<
	Resources extends AnyResources,
	Resource extends keyof AnyResources,
	Request extends AnySettableResource['request'],
> = ResourceParams<Resource> extends null
	? SetHandler<Resources, Resource, Request>
	: SetHandlerWithParams<Resources, Resource, Request>;

export type SubscribeHandler<
	Resources extends AnyResources,
	Resource extends keyof AnyResources,
> = (args: {
	clientId: number;
	resource: Resource;
}) => Subscribable<z.infer<Resources[Resource]['response']>>;

export type SubscribeHandlerWithParams<
	Resources extends AnyResources,
	Resource extends keyof AnyResources,
> = (args: {
	clientId: number;
	params: ResourceParams<Resource>;
	resourceWithParams: string;
	resource: Resource;
}) => Subscribable<z.infer<Resources[Resource]['response']>>;

export type PickSubscribeHandler<
	Resources extends AnyResources,
	Resource extends keyof AnyResources,
> = ResourceParams<Resource> extends null
	? SubscribeHandler<Resources, Resource>
	: SubscribeHandlerWithParams<Resources, Resource>;

export type Router<Resources extends AnyResources> = {
	[R in keyof Resources & string]: Resources[R] extends {
		type: 'get';
	}
		? { get: PickGetHandler<Resources, R> }
		: Resources[R] extends {
				type: 'set';
				request: infer Request extends z.ZodTypeAny;
		  }
		? { set: PickSetHandler<Resources, R, Request> }
		: Resources[R] extends {
				type: 'subscribe';
		  }
		? { subscribe: PickSubscribeHandler<Resources, R> }
		: Resources[R] extends {
				type: 'get|set';
				request: infer Request extends z.ZodTypeAny;
		  }
		? {
				get: PickGetHandler<Resources, R>;
				set: PickSetHandler<Resources, R, Request>;
		  }
		: Resources[R] extends {
				type: 'get|subscribe';
		  }
		? {
				get: PickGetHandler<Resources, R>;
				subscribe: PickSubscribeHandler<Resources, R>;
		  }
		: Resources[R] extends {
				type: 'set|subscribe';
				request: infer Request extends z.ZodTypeAny;
		  }
		? {
				set: PickSetHandler<Resources, R, Request>;
				subscribe: PickSubscribeHandler<Resources, R>;
		  }
		: Resources[R] extends {
				type: 'get|set|subscribe';
				request: infer Request extends z.ZodTypeAny;
		  }
		? {
				get: PickGetHandler<Resources, R>;
				set: PickSetHandler<Resources, R, Request>;
				subscribe: PickSubscribeHandler<Resources, R>;
		  }
		: never;
};

export interface ServerLogger {
	receivedRequest: (
		request: Request<any>,
		clientId: number,
		remoteAddress: string | undefined,
	) => void;
}
