export type ChatCompletionMessage = {
    role: string,
    content: string,
}

export type ChatCompletionRequest = {
    model: string,
    messages: ChatCompletionMessage[],
    temperature: number,
}

export type ChatCompletionResponse = {
    id: string,
    object: string,
    created: number,
    model: string,
    usage:{
       prompt_tokens: number,
       completion_tokens: number,
       total_tokens: number,
    },
    choices:[
       {
          message : ChatCompletionMessage,
          finish_reason: string,
          index: number
       }
    ]
 }


 export const fetchChatCompletion = async (apiKey: string, messages: ChatCompletionMessage[], temperature = 0.7): Promise<ChatCompletionResponse> => {
    const headers = new Headers({
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    });

    const body = JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        temperature,
    });

    console.log(`Sending request to OpenAI: ${body}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        body,
        headers,
    });

    return await response.json() as ChatCompletionResponse;
 }
