import { db } from './db.js';

/**
 * @typedef {import("../resources.js").Resources} Resources
 * @typedef {import("smolrpc").Router<Resources>} Router
 */

/**
 * @template {keyof Resources} Resource
 * @typedef {import("smolrpc").Result<Resources, Resource>} Result
 */

/**
 * @const
 * @satisfies {Router}
 */
export const router = {
	'/resourceA': {
		async get({ resource }) {
			console.log('get', resource);
			const result = db.get(resource);
			return /** @type {Result<typeof resource>} */ (result);
		},
	},
	'/resourceB/:id': {
		get: async ({ params, qualifiedResource, resource }) => {
			console.log('get', resource, qualifiedResource, params);
			const result = /** @type {Result<typeof resource>} */ (
				db.get(qualifiedResource)
			);
			return result;
		},
		set: async ({ params, qualifiedResource, resource, request }) => {
			console.log('set', resource, qualifiedResource, params, request);
			db.set(qualifiedResource, request);
		},
		subscribe: ({ params, qualifiedResource, resource }) => {
			console.log('subscribe', resource, qualifiedResource, params);
			const result = db.subscribe(qualifiedResource);
			return result;
		},
	},
	'/resourceB/:id/resourceC/:key': {
		get: async ({ params, qualifiedResource, resource }) => {
			console.log('get', resource, qualifiedResource, params);
			const result = db.get(qualifiedResource);
			return /** @type {Result<typeof resource>} */ (result);
		},
		set: async ({ params, qualifiedResource, resource, request }) => {
			console.log('set', resource, qualifiedResource, params, request);
			db.set(qualifiedResource, request);
		},
	},
};
