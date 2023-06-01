import { Env } from './environment';

export type ImageOutput = {
	data: string,
	seed: number,
	path_abs: string
}

export type ImageStreamResponse = {
	status: string,
	render_request: EasyDiffusionRequest,
	task_data: {
		request_id: number,
		session_id: string,
		save_to_disk_path: string | null,
		vram_usage_level: string,
		use_face_correction: string | null,
		use_upscale: string | null,
		upscale_amount: number,
		use_stable_diffusion_model: string,
		use_vae_model: string | null,
		use_hypernetwork_model: string | null,
		use_lora_model: string | null,
		show_only_filtered_image: boolean,
		block_nsfw: boolean,
		output_format: string,
		output_quality: number,
		output_lossless: boolean,
		metadata_output_format: string,
		stream_image_progress: boolean,
		stream_image_progress_interval: number,
	},
	output: ImageOutput[]
}

export type EasyDiffusionRequest = {
	prompt : string,
	negative_prompt : string,
	seed : number,
	width : number,
	height : number,
	num_outputs : number,
	num_inference_steps : number,
	guidance_scale : number,
	prompt_strength : number,
	sampler_name : string,
	hypernetwork_strength : number,
	lora_alpha : number,
	preserve_init_image_color_profile : boolean,
	use_stable_diffusion_model : string
};

export type RenderResponse = {
	status: string,
	queue: number,
	stream: string,
	task: number,
};

export const easyDiffusionRequest = {
	prompt : "an astronaut riding a horse, trending on artstation",
	negative_prompt : "",
	seed : Math.random() * 100000000,
	width : 768,
	height : 512,
	num_outputs : 1,
	num_inference_steps : 10,
	guidance_scale : 7.1,
	prompt_strength : 0.0,
	sampler_name : "ddim",
	hypernetwork_strength : 0.0,
	lora_alpha : 0.0,
	preserve_init_image_color_profile : false,
	use_stable_diffusion_model : ""
};

export const createImage = async (prompt: string, env: Env) => {
    const req = Object.assign({}, easyDiffusionRequest, { prompt });
    return await getStream(req, env);
};

const getStream = async (edRequest: EasyDiffusionRequest, env: Env) => {
	const request = new Request("https://sd.aicyoa.com/render", {
		method: "POST",
		body: JSON.stringify({ ...edRequest, use_stable_diffusion_model: env.SD_MODEL } as EasyDiffusionRequest),
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
			"CF-Access-Client-Id": env.CF_ACCESS_CLIENT_ID,
			"CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET,
		},
	});
	console.log("Sending render request");
	const response = await fetch(request);
	if (response.status !== 200) {
		console.log("Render request failed");
		return [null, new Error(response.statusText)];
	}
	console.log("Render request successful");
	try {
		const renderResponse = await response.json() as RenderResponse;

		let [image, err] = await getImage(renderResponse.stream, env);
		while (image == null && err == null) {
			await new Promise(r => setTimeout(r, 3000));
			console.log("Waiting for image");
			[image, err] = await getImage(renderResponse.stream, env);
		}
		return (err != null) ? [null, err] : [image, null];
	}
	catch (e) {
		console.log("Render json parse failed " + JSON.stringify(response));
		return [null, e];
	}
};

const getImage = async (stream: string, env: Env) => {
	const streamUrl = `https://sd.aicyoa.com${stream}`;
	const request = new Request(streamUrl, {
		method: "GET",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
			"CF-Access-Client-Id": env.CF_ACCESS_CLIENT_ID,
			"CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET
		},
	});
	console.log(`Getting image from ${streamUrl}`);
	const response = await fetch(request);
	if (response.status !== 200) {
		console.log("Image request failed " + JSON.stringify(response));
		return [null, null];
	}
	try {
		const streamResponse = await response.json() as ImageStreamResponse;
		if (!streamResponse.status || streamResponse.status !== "succeeded")
			return [null, null];

		if (!streamResponse.output?.length) {
			console.log("No image in stream response");
			return [null, null];
		}
		const image = streamResponse.output[0];

		return [image.data, null];
	} catch (e) {
		console.log("Image json parse failed " + JSON.stringify(e));
		return [null, null];
	}
}
