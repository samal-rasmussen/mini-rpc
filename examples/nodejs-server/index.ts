import { WebSocketServer } from 'ws';
import { WS, initServer } from '../../src/init-server.js';
import { router } from './router.js';
import { Resources, resources } from '../resources.js';

const server = initServer<Resources>(router, resources, {
	serverLogger: {
		receivedRequest: (request, clientId, remoteAddress) => {
			console.log(
				`${clientId} ${remoteAddress} ${JSON.stringify(request)}`,
			);
		},
	},
});
const wss = new WebSocketServer({ port: 9200 });

wss.on('connection', function connection(ws, req) {
	server.addConnection(
		{
			addEventListener: ws.addEventListener.bind(ws),
			send: ws.send.bind(ws),
		},
		req,
	);
});