# smolrpc

A really smol typesafe rpc implementation.

Communicates over websockets and supports three operations on user defined resources: get, set, and subscribe.

Uses Zod for runtime typechecking. No other dependencies.

Inspired by tRPC (https://trpc.io/), ts-rest (https://ts-rest.com/), and Zodios (https://www.zodios.org/).

You define the api in one place and import and use the same api types on both the server and the client.

Get and set ar practically the same, but it is a useful distinction so you can do read/write separation on the backedn, which is useful if you need to scale up and use leader/follower db clusters.

Subscriptions can be defined on the same resources as get and set operations, and are rxjs observable compatible.

All actions are on statically typed resource urls that support statically parsed params. You then define the request and response Zod types for such a resource.

# How to use

## Resources
First you need to define your typed resources using a resource object like in `example/resources.ts`.

## Server
Then you define a router with resource handlers like in `example/nodejs-server/router.ts`.

## Client
The Client is autogenerated using the resource object as the type and a Proxy object as the implementation, and you can just jump in and use the statically typed client like in `example/nodejs-client/index.ts`.

```ts
// client-example.ts
import { initClient } from 'smolrpc';
import type { Resources } from './resources';

const client = await initClient<SimpleResources>({
	url: 'ws://localhost:9200',
});

// type: { content: string; id: string; }[]
const posts = await client['/posts'].get();
// type: { content: string; id: string; }
const post123 = await client['/posts/:postId'].get({
	params: { postId: 123 },
});
client['/posts/:postId']
	.subscribe({
		params: { postId: 123 },
	})
	.subscribe({
		next: (post) => {
			console.log('event', post);
		},
	});
await client['/posts/:postId'].set({
	params: { postId: 123 },
	request: { content: 'sick post' },
});
```

```ts
// resources.ts
import { z } from 'zod';
import { AnyResources } from 'smolrpc';

const post = z.object({
	content: z.string(),
	id: z.string(),
});

export const resources = {
	'/posts': {
		response: z.array(post),
		type: 'get|subscribe',
	},
	'/posts/:id': {
		request: post.omit({ id: true }),
		response: post,
		type: 'get|set|subscribe',
	},
} as const satisfies AnyResources;
export type Resources = typeof resources;
```

# How to run examples

Run these three commands in three separate terminals:
```
$ npm run check
$ npm run nodejs-server
$ npm run nodejs-client
```
