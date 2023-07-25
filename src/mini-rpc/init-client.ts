import type { AnyResources, Subscribable } from './types';
import type {
	Params,
	Reject,
	Request,
	Response,
	SubscribeEvent,
} from './message-types';
import type { Client } from './client.types';

export async function initClient<Resources extends AnyResources>(
	websocket: WebSocket,
): Promise<Client<Resources>> {
	return new Promise((resolve, reject) => {
		const proxy = new Proxy({} as any, {
			get(target, p: any, receiver) {
				return {
					get: (args: { params: Params } | undefined) =>
						getHandler(p, args?.params),
					set: ({
						request,
						params,
					}: {
						request: any;
						params: Params;
					}) => setHandler(p, request, params),
					subscribe: (args: { params: Params }) =>
						subscribeHandler(p, args?.params),
				};
			},
		});

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
			const response = JSON.parse(event.data as string) as
				| Response<Resources>
				| SubscribeEvent<Resources>
				| Reject<Resources>;
			const id =
				response.type === 'Reject' ? response.request.id : response.id;
			const listener = listeners.get(id);
			if (listener == null) {
				console.error(`No listener found for response/event`, response);
				return;
			}
			listener(response);
		};

		const listeners = new Map<
			Number,
			(
				msg:
					| Response<Resources>
					| SubscribeEvent<Resources>
					| Reject<Resources>,
			) => void
		>();
		let id = 0;

		function sendMessage(msg: Request<Resources>): void {
			websocket.send(JSON.stringify(msg));
		}

		function getHandler(
			resource: keyof Resources,
			params: Params,
		): Promise<unknown> {
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
		function setHandler(
			resource: keyof Resources,
			request: any,
			params: Params,
		): Promise<unknown> {
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
		function subscribeHandler(
			resource: keyof Resources,
			params: Params,
		): Subscribable<unknown> {
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
