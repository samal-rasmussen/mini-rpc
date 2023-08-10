/**
 * @typedef {import("./types.ts").Unsubscribable} Unsubscribable
 * @typedef {import("./message.types.ts").Params} Params
 * @typedef {import("./message.types.ts").Reject<any>} Reject
 * @typedef {import("./message.types.ts").Request<any>} Request
 * @typedef {import("./server.types.ts").GetHandler<any, any>} GetHandler
 * @typedef {import("./server.types.ts").GetHandlerWithParams<any, any>} GetHandlerWithParams
 * @typedef {import("./server.types.ts").PickSetHandler<any, any, any>} PickSetHandler
 * @typedef {import("./server.types.ts").PickSubscribeHandler<any, any>} PickSubscribeHandler
 * @typedef {import("./server.types.ts").SetHandlerWithParams<any, any, any>} SetHandlerWithParams
 * @typedef {import("./server.types.ts").SubscribeHandlerWithParams<any, any>} SubscribeHandlerWithParams
 * @typedef {import("./websocket.types.ts").WS} WS
 */

import { getResourceWithParams } from './shared.js';

/**
 * @type {(ws: WS, error: string, request: Request) => void}
 */
function sendReject(ws, error, request) {
	/** @type {Reject} */
	const reject = {
		error,
		type: 'Reject',
		request,
	};
	ws.send(JSON.stringify(reject));
}

/**
 * @param {string} resource
 * @param {Params} params
 * @returns {boolean}
 */
function validateParams(resource, params) {
	const count = resource.split(':').length - 1;
	if (count > 0) {
		if (params == null) {
			return false;
		}
		if (Object.keys(params).length !== count) {
			return false;
		}
	}
	return true;
}

/**
 *
 * @param {any} result
 * @param {import('zod').ZodTypeAny} parser
 * @param {string} resource
 * @returns
 */
function parseResult(result, parser, resource) {
	const parsed = parser.safeParse(result);
	if (!parsed.success) {
		console.error(`invalid route response for ${resource}`, result);
		return;
	}
}

/**
 * @template {import("./types").AnyResources} Resources
 * @param {import("./server.types.ts").Router<Resources>} router
 *  @param {import("./types.ts").AnyResources} resources
 * @returns {{ addConnection: (ws: WS) => void }}
 */
export function initServer(router, resources) {
	/**
	 * @type {Map<WS, Map<string, Unsubscribable>>}
	 */
	const listeners = new Map();

	/**
	 *
	 * @param {WS} ws
	 * @returns {Map<string, Unsubscribable>}
	 */
	function getWebSocketListeners(ws) {
		const websocketListeners = listeners.get(ws);
		if (websocketListeners == null) {
			throw new Error(
				'Did not find map of listeners for websocket connection',
			);
		}
		return websocketListeners;
	}

	/**
	 * @param {WS} ws
	 */
	function addConnection(ws) {
		const existing = listeners.get(ws);
		if (existing != null) {
			throw new Error(
				'initServer.onOpen: Found unexpected existing map of listeners for websocket connection',
			);
		}
		listeners.set(ws, new Map());
		ws.addEventListener('close', () => {
			const existing = listeners.get(ws);
			if (existing == null) {
				throw new Error(
					'initServer.onClose: Map of listeners for websocket connection not found',
				);
			}
			for (const unsubscribable of existing.values()) {
				unsubscribable.unsubscribe();
			}
			listeners.delete(ws);
		});
		ws.addEventListener('error', (event) => {
			console.error(`initServer.onError: ${event}`);
		});
		ws.addEventListener('message', async (event) => {
			await handleWSMessage(event.data, ws);
		});
	}

	/**
	 * @param {import("./websocket.types.ts").Data} data
	 * @param {WS} ws
	 */
	async function handleWSMessage(data, ws) {
		if (typeof data != 'string') {
			console.error(
				`only string data supported. typeof event.data = ${typeof data}`,
			);
			return;
		}
		// console.log('received: %s', data);
		/** @type {Request} */
		const request = JSON.parse(data);
		if (typeof request.id !== 'number') {
			console.error(`no id number on message`);
			return;
		}
		if (typeof request.resource !== 'string') {
			console.error(`no resource string on message`);
			return;
		}
		const routerHandlers = router[request.resource];
		if (routerHandlers == null) {
			console.error(`router handler for resource not found`, request);
			sendReject(ws, `resource not found`, request);
			return;
		}
		const resourceDefinition = resources[request.resource];
		if (resourceDefinition == null) {
			console.error(
				`resource definition for resource not found`,
				request,
			);
			sendReject(ws, `resource not found`, request);
			return;
		}
		if (!validateParams(request.resource, request.params)) {
			sendReject(ws, `invalid params`, request);
			return;
		}
		if (request.type === 'GetRequest') {
			try {
				/** @type {Parameters<GetHandlerWithParams>[0]} */
				const args = /** @type {any} */ ({
					resource: request.resource,
				});
				if (request.params != null) {
					const resourceWithParams = getResourceWithParams(
						request.resource,
						request.params,
					);
					args.params = request.params;
					args.resourceWithParams = resourceWithParams;
				}
				const routeHandler = /** @type {{get: GetHandlerWithParams}}*/ (
					/** @type {any}*/ (routerHandlers)
				).get;
				console.log('get', args);
				const result = await routeHandler(args);
				const parsed = resourceDefinition.response.safeParse(result);
				if (!parsed.success) {
					console.error(
						`invalid route response for ${request.resource}`,
						result,
					);
					return;
				}
				/** @type {import("./message.types.ts").GetResponse<any>} */
				const response = {
					id: request.id,
					data: parsed.data,
					type: 'GetResponse',
					resource: request.resource,
				};
				// console.log(response, JSON.stringify(response));
				ws.send(JSON.stringify(response));
			} catch (error) {
				console.error(error);
				sendReject(ws, '500', request);
			}
		} else if (request.type === 'SetRequest') {
			try {
				/** @type {Parameters<SetHandlerWithParams>[0]} */
				const args = /** @type {any} */ ({
					resource: request.resource,
					request: request.data,
				});
				if (request.params != null) {
					const resourceWithParams = getResourceWithParams(
						request.resource,
						request.params,
					);
					args.params = request.params;
					args.resourceWithParams = resourceWithParams;
				}
				/** @type {PickSetHandler} */
				const routeHandler = /** @type {{set: SetHandlerWithParams}}*/ (
					/** @type {any}*/ (routerHandlers)
				).set;
				console.log('set', args);
				const result = await routeHandler(args);
				const parsed = resourceDefinition.response.safeParse(result);
				if (!parsed.success) {
					console.error(
						`invalid route response for ${request.resource}`,
						result,
					);
					return;
				}
				/** @type {import("./message.types.ts").SetSuccess<any>} */
				const response = {
					id: request.id,
					resource: request.resource,
					data: parsed.data,
					type: 'SetSuccess',
				};
				ws.send(JSON.stringify(response));
			} catch (error) {
				console.error(error);
				sendReject(ws, '500', request);
			}
		} else if (request.type === 'SubscribeRequest') {
			try {
				/** @type {Parameters<SubscribeHandlerWithParams>[0]} */
				const args = /** @type {any} */ ({
					resource: request.resource,
				});
				if (request.params != null) {
					const resourceWithParams = getResourceWithParams(
						request.resource,
						request.params,
					);
					args.params = request.params;
					args.resourceWithParams = resourceWithParams;
				}
				const websocketListeners = getWebSocketListeners(ws);
				const existingSubscription = websocketListeners.get(
					args.resourceWithParams ?? args.resource,
				);
				if (existingSubscription != null) {
					sendReject(ws, 'Already subscribed', request);
					return;
				}
				/** @type {PickSubscribeHandler} */
				const routerHandler =
					/** @type {{subscribe: SubscribeHandlerWithParams}}*/ (
						/** @type {any}*/ (routerHandlers)
					).subscribe;
				console.log('subscribe', args);
				const observable = await routerHandler(args);
				const subscription = observable.subscribe({
					next(val) {
						const parsed =
							resourceDefinition.response.safeParse(val);
						if (!parsed.success) {
							console.error(
								`invalid route response for ${request.resource}`,
								val,
							);
							return;
						}
						/** @type {import("./message.types.ts").SubscribeEvent<any>} */
						const event = {
							data: val,
							id: request.id,
							resource: request.resource,
							type: 'SubscribeEvent',
						};
						ws.send(JSON.stringify(event));
					},
				});
				websocketListeners.set(
					args.resourceWithParams ?? args.resource,
					subscription,
				);
				/** @type {import("./message.types.ts").SubscribeAccept<any>} */
				const response = {
					id: request.id,
					resource: request.resource,
					type: 'SubscribeAccept',
				};
				ws.send(JSON.stringify(response));
			} catch (error) {
				console.error(error);
				sendReject(ws, '500', request);
			}
		} else if (request.type === 'UnsubscribeRequest') {
			try {
				const resource =
					request.params != null
						? getResourceWithParams(
								request.resource,
								request.params,
						  )
						: request.resource;
				const websocketListeners = getWebSocketListeners(ws);
				const subscription = websocketListeners.get(resource);
				if (subscription == null) {
					sendReject(ws, 'Not subscribed', request);
					return;
				}
				subscription.unsubscribe();
				websocketListeners.delete(resource);
				/** @type {import("./message.types.ts").UnsubscribeAccept<any>} */
				const response = {
					id: request.id,
					resource: request.resource,
					type: 'UnsubscribeAccept',
				};
				ws.send(JSON.stringify(response));
			} catch (error) {
				console.error(error);
				sendReject(ws, '500', request);
			}
		} else {
			try {
				exhaustive(request);
			} catch (e) {
				sendReject(ws, `Invalid request type`, request);
			}
		}
	}

	return {
		addConnection,
	};
}

/** @type {(arg: never) => never} */
function exhaustive(arg) {
	throw new Error(`Failed exhaustive check. Expected never but got ${arg}`);
}
