/**
 * @typedef {import("./types").AnyResources} AnyResources
 * @typedef {import("./types").Subscribable<any>} Subscribable
 * @typedef {import("./message.types").Params} Params
 * @typedef {import("./message.types").Reject<any>} Reject
 * @typedef {import("./message.types").Request<any>} Request
 * @typedef {import("./message.types").Response<any>} Response
 * @typedef {import("./message.types").SubscribeEvent<any>} SubscribeEvent
 * @typedef {import("./client.types").Client<any>} Client
 */

/**
 * @type {typeof import("./client.types").initClient}
 */
export async function initClient(websocket) {
	return new Promise((resolve, reject) => {
		/** @type {any} */
		const proxy = new Proxy(
			{},
			{
				get(target, /** @type {any} */ p, receiver) {
					return {
						get: (/** @type {{ params: Params; }} */ args) =>
							getHandler(p, args?.params),
						set: (
							/** @type {{ params: Params; request: any }} */ {
								request,
								params,
							},
						) => setHandler(p, request, params),
						subscribe: (/** @type {{ params: Params; }} */ args) =>
							subscribeHandler(p, args?.params),
					};
				},
			},
		);

		websocket.onopen = (event) => {
			console.log('websocket connected');
			resolve(proxy);
		};
		websocket.onclose = (event) => {
			console.log(
				'websocket.onclose',
				event.type,
				event.code,
				event.reason,
			);
			reject();
		};
		websocket.onerror = (event) => {
			console.log('websocket.onerror', event.type, event);
		};
		websocket.onmessage = (event) => {
			// console.log(
			// 	'socket.onmessage',
			// 	event.type,
			// 	typeof event.data,
			// 	event.data,
			// );
			/** @type { Response | SubscribeEvent | Reject} */
			const response = JSON.parse(event.data);
			const id =
				response.type === 'Reject' ? response.request.id : response.id;
			const listener = listeners.get(id);
			if (listener == null) {
				console.error(`No listener found for response/event`, response);
				return;
			}
			listener(response);
		};

		/**
		 * @type {Map<number, (msg: Response | SubscribeEvent | Reject) => void>}
		 */
		const listeners = new Map();
		let id = 0;

		/**
		 * @param {Request} msg
		 */
		function sendMessage(msg) {
			websocket.send(JSON.stringify(msg));
		}

		/**
		 * @param {PropertyKey} resource
		 * @param {Params} params
		 * @returns {Promise<unknown>}
		 */
		function getHandler(resource, params) {
			return new Promise((resolve, reject) => {
				const msgId = ++id;
				sendMessage({
					id: msgId,
					resource,
					params,
					type: 'GetRequest',
				});
				listeners.set(msgId, (msg) => {
					listeners.delete(msgId);
					if (msg.type === 'Reject') {
						reject(msg.error);
					} else if (msg.type === 'GetResponse') {
						resolve(msg.data);
					} else {
						console.error(
							`Unexpected message type in get listener`,
							msg,
						);
					}
				});
			});
		}
		/**
		 * @param {PropertyKey} resource
		 * @param {any} request
		 * @param {Params} params
		 * @returns {Promise<unknown>}
		 */
		function setHandler(resource, request, params) {
			return new Promise((resolve, reject) => {
				const msgId = ++id;
				sendMessage({
					id: msgId,
					resource,
					data: request,
					params,
					type: 'SetRequest',
				});
				listeners.set(msgId, (msg) => {
					listeners.delete(msgId);
					if (msg.type === 'Reject') {
						reject(msg.error);
					} else if (msg.type === 'SetSuccess') {
						resolve(undefined);
					} else {
						console.error(
							`Unexpected message type in set listener`,
							msg,
						);
					}
				});
			});
		}
		/**
		 *
		 * @param {PropertyKey} resource
		 * @param {Params} params
		 * @returns {Subscribable}
		 */
		function subscribeHandler(resource, params) {
			return {
				subscribe: (observer) => {
					const msgId = ++id;
					sendMessage({
						id: msgId,
						resource,
						params,
						type: 'SubscribeRequest',
					});
					listeners.set(msgId, (msg) => {
						if (msg.type === 'Reject') {
							reject(msg.error);
						} else if (msg.type === 'SubscribeEvent') {
							observer.next?.(msg.data);
						} else if (msg.type === 'SubscribeAccept') {
							// Happy path. Nothing to do.
						} else {
							console.error(
								`Unexpected message type in get listener`,
								msg,
							);
						}
					});
					return {
						unsubscribe: () => {
							listeners.delete(msgId);
							const unsubMsgId = ++id;
							sendMessage({
								id: unsubMsgId,
								params,
								resource,
								type: 'UnsubscribeRequest',
							});
							listeners.set(unsubMsgId, (msg) => {
								if (msg.type === 'Reject') {
									reject(msg.error);
								} else if (msg.type === 'UnsubscribeAccept') {
									// Happy path. Nothing to do.
								} else {
									console.error(
										`Unexpected message type in get listener`,
										msg,
									);
								}
							});
						},
					};
				},
			};
		}
	});
}
