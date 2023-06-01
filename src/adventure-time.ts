import { v4 } from 'uuid';
import { Env } from './environment';
import { createImage } from './easy-diffusion';
import { ChatCompletionMessage, ChatCompletionRequest, ChatCompletionResponse, fetchChatCompletion } from './openai-mine';

export type ChatResponse = {
    narrative: string,
    imagery: string,
    endOfGame: boolean,
};

export type Chapter = {
    user: string,
    narrative: string,
    imagery: string,
    image: string,
};

export type Adventure = {
    id: string,
    title: string,
    chapters: Chapter[],
    adventureEnded: boolean,
};

export type ContinueAdventureResponse = {
    success: boolean,
    adventure: Adventure | null,
    error: Error | null,
};

export const createNewAdventure = async (prompt: string, env: Env): Promise<ContinueAdventureResponse> => {
    const adventure = {
        id: v4(),
        title: '',
        chapters: [],
        adventureEnded: false,
    };

    await env.ADVENTURES.put(adventure.id, JSON.stringify(adventure));
    return await continueAdventure(adventure.id, prompt, env);
};

export const continueAdventure = async (id: string, message: string, env: Env): Promise<ContinueAdventureResponse> => {
    const adventure = await env.ADVENTURES.get(id, 'json') as Adventure;
    if (adventure == null) {
        return {
            success: false,
            adventure: null,
            error: new Error('Adventure not found'),
        };
    }

    const chatMessages: ChatCompletionMessage[] = adventure.chapters.flatMap((chapter) => {
        const msgs = [];
        msgs.push({
            role: 'user',
            content: chapter.user,
        });
        msgs.push({
            role: 'assistant',
            content: `{"narrative": "${chapter.narrative}", "imagery": "${chapter.imagery}"}`,
        });
        return msgs;
    });

    const messages = [
        {
            role: 'system',
            content: `You are a helpful assistant that generates JSON objects. You are also a master of mystery storytelling, detailed AI imagery prompts, and choose your own adventure games. You are the user's guide through the world you create where they have to solve some sort of mystery you've created for them. You will create the narrative along with imagery prompts used for AI image generation. Every prompt from the user is part of the game and should only be used to move the story forward. The game begins at START_GAME`,
        },
        {
            role: 'system',
            content: `The output must look like this: { "narrative": "You story narrative goes here", "imagery": "Your imagery prompt goes here" }`,
        },
        {
            role: 'user',
            content: 'I move to the next room',
        },
        {
            role: 'assistant',
            content: `{"narrative": "You enter a room with a single chair in the middle of the room. There is a single light bulb hanging from the ceiling. The room is dark and you can't see anything else.", "imagery": "dark room, single chair, light bulb hanging from ceiling"}`,
        },
        {
            role: 'user',
            content: 'START_GAME',
        },
        ...chatMessages,
        {
            role: 'user',
            content: message,
        },
    ];
    /*
    if (messages.length < 10) {
        messages.unshift({
            role: 'assistant',
            content: `{"narrative": "You've solved the mystery!", "imagery" : "golden sunrise, war torn field, single flower", "endOfGame": true }`
        });
        messages.unshift({
            role: 'user',
            content: `It was the butler with the candlestick in the library!`,
        });
        messages.unshift({
            role: 'assistant',
            content: `{"narrative": "Out of breath you enter an abandoned home. \"Hello stranger. I could use some help\"", "imagery" : "home entry way, broken floor boards, cobwebs hanging, dust in the air, only light source through a grimy window, in the style of noire", "endOfGame": false }`,
        });
        messages.unshift({
            role: 'user',
            content: `Hello?`,
        });
    } */

    const chatResponse = await fetchChatCompletion(env.OPENAI_API_KEY, messages);

    if (!chatResponse?.choices?.length) {
        console.error(`Chat completion failed ${chatResponse.id}`);
        return {
            success: false,
            adventure: null,
            error: new Error("Storyteller is unavailable"),
        };
    }
    const content = chatResponse?.choices[0].message.content;
    try {
        const json = JSON.parse(content);
        if (!json.narrative || !json.imagery) {
            console.error(`Chat returned invalid content ${content}`);
            return {
                success: false,
                adventure: null,
                error: new Error("Storyteller is unavailable"),
            };
        }

        const [image, err] = await createImage(json.imagery, env);
        if (err != null) {
            console.error(`Image creation failed with prompt ${json.imagery}`);
        };

        const newChapter = {
            user: message,
            narrative: json.narrative,
            imagery: json.imagery,
            image: (image != null) ? image : '',
        } as Chapter;

        adventure.chapters.push(newChapter);

        await env.ADVENTURES.put(adventure.id, JSON.stringify(adventure));

        return {
            success: true,
            adventure,
            error: null,
        };
    } catch (e) {
        console.error(`Chat returned invalid content ${content}`);
    }
    return {
        success: false,
        adventure: null,
        error: new Error("Storyteller is unavailable"),
    };
};