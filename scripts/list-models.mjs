import {GoogleGenAI} from '@google/genai';
if(!process.env.GEMINI_API_KEY)throw new Error('GEMINI_API_KEY missing. No model was guessed or selected.');
const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});const models=await ai.models.list({config:{pageSize:100}});for await(const model of models)console.log(`${model.name}\t${(model.supportedActions??[]).join(', ')}`);
