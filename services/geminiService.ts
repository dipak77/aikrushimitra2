
import { GoogleGenAI } from "@google/genai";

// Function to analyze crop disease from image
export const analyzeCropDisease = async (base64Image: string, lang: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  try {
    const prompt = lang === 'mr' 
      ? "हे पीक ओळखा आणि एक अनुभवी गावचा जाणकार शेतकरी जसा सल्ला देईल तसा अस्सल ग्रामीण मराठमोळ्या भाषेत सांगा. 'आरं बघा, तुमच्या झाडाला हा असा त्रास झालाय...' अशा भाषेत सुरुवात करा. रोगाचे नाव, नक्की कारण आणि घरगुती जालीम उपाय सांगा. उत्तर खूप लांबलचक नसावे, जसे आपण समोरासमोर गप्पा मारतो तसे सांगा."
      : "Identify this crop and disease. Speak like a friendly local agri-expert. Tell name, cause, and organic remedies in a warm, native conversational tone. Keep it concise as if talking face-to-face.";

    const base64Data = base64Image.split(',')[1];

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          },
          { text: prompt }
        ]
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Image Error:", error);
    return lang === 'mr' ? "आरं देवा, फोटो बघताना काहीतरी अडचण आलीया. एकदा परत प्रयत्न करा बरं." : "Error in analysis. Try again.";
  }
};

// Function to get general farming advice via text chat
export const getAIFarmingAdvice = async (query: string, lang: string, cropContext: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  try {
    const systemInstruction = lang === 'mr' 
      ? `तुला 'AI कृषी मित्र' म्हणून बोलायचे आहे. तू रोबोट नाहीस, तर गावातील एक अनुभवी, कष्टाळू आणि प्रेमळ जाणकार शेतकरी आहेस. 
      
      भाषेची शैली:
      - अस्सल ग्रामीण मराठमोळी भाषा वापर (उदा. 'आरं', 'बरं का', 'बघा की', 'लय भारी', 'काळजी नको', 'नक्कीच').
      - शुद्ध आणि पुस्तकी मराठी टाळ. जसं आपण शेताच्या बांधावर बसून गप्पा मारतो, तसं बोल.
      - शेतकरी सध्या ${cropContext} या पिकाची काळजी घेत आहे, हे लक्षात ठेवून सल्ला दे.
      - उत्तरं खूप मोठी देऊ नकोस, ऐकायला जशी गोड वाटतील तशी लहान आणि मुद्देसूद वाक्य बोल.
      - 'नमस्कार' म्हणण्यापेक्षा 'राम राम' किंवा 'कसं काय पाटील' असं वापरलं तर अधिक चांगलं.`
      : `You are 'AI Krushi Mitra'. You are a wise, helpful local farmer and expert. 
      
      TONE:
      - Native, warm, and realistic. 
      - Speak like a friendly neighbor under a village tree.
      - Context: Farmer is tending to ${cropContext}.
      - Keep it conversational and concise.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: query,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Text Error:", error);
    return lang === 'mr' ? "काहीतरी गडबड झालीये बरं का, जरा वेळाने पुन्हा बोलूया." : "Something went wrong, let's talk in a bit.";
  }
};

// Function to get soil specific fertilizer recommendations
export const getSoilAdvice = async (npk: {n: number, p: number, k: number}, crop: string, lang: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    try {
        const prompt = `Soil NPK is N:${npk.n}, P:${npk.p}, K:${npk.k}. Crop is ${crop}. 
        Give advice in native ${lang === 'mr' ? 'Rural Marathi' : 'Hindi/English'} tone. Explain simply like a village expert.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
        });
        
        return response.text;
    } catch (e) {
        return "Error fetching advice.";
    }
}
