import { Env } from './environment';
import { createNewAdventure, continueAdventure } from './adventure-time';

export type AdventureRequest = {
	id: string,
	prompt: string,
};

const getOrigin = (request: Request): string => {
	const origin = request.headers.get('Origin');
	if (origin == null) {
		return '';
	}
	if (origin.indexOf('localhost:5173') > -1 || origin.indexOf('aicyoa.com') > -1) {
		return origin;
	}
	return '';
};


function handleOptions (request: Request, corsHeaders: Headers) {
	// Make sure the necessary headers are present
	// for this to be a valid pre-flight request
	let headers = request.headers
	if (
		headers.get('Origin') !== null
	) {
		corsHeaders.set('Access-Control-Allow-Headers', request.headers.get('Access-Control-Request-Headers') ?? '*');
		corsHeaders.set('Allow', 'GET, HEAD, POST, PUT, OPTIONS');
		return new Response(null, {
			status: 204,
			headers: corsHeaders,
		});
	}
	else {
		// Handle standard OPTIONS request.
		// If you want to allow other HTTP Methods, you can do that here.
		return new Response(null, {
				status: 204,	
				headers: {
						Allow: 'GET, HEAD, POST, PUT, OPTIONS',
				},
		});
	}
};

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const corsHeaders = new Headers({
			'Access-Control-Allow-Origin': getOrigin(request),
			'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,OPTIONS',
			'Access-Control-Max-Age': '86400',
		});
		if (request.method === 'OPTIONS') {
			console.log('Handling OPTIONS request');
			return handleOptions(request, corsHeaders);
		}
		const requestParams = {
			status: 200,
			headers: corsHeaders,
		};
		requestParams.headers.set('Content-Type', 'application/json');

		// Starting a new adventure
		if (request.method === 'POST') {
			const req = await request.json() as AdventureRequest;
			var adv = await createNewAdventure(req.prompt, env);
			if (adv.success) {
				return new Response(JSON.stringify(adv), requestParams);
			} else {
				requestParams.status = 500;
				return new Response(JSON.stringify(adv), requestParams);
			}
		}

		if (request.method === 'PUT') {
			const req = await request.json() as AdventureRequest;
			var adv = await continueAdventure(req.id, req.prompt, env);
			if (adv.success) {
				return new Response(JSON.stringify({ id: adv.adventure?.id, chapter: adv.adventure?.chapters.pop() }), requestParams);
			} else {
				requestParams.status = 500;
				return new Response(JSON.stringify(adv), requestParams);
			}
		}

		return new Response(JSON.stringify({ success: true }), requestParams);
	},
};
