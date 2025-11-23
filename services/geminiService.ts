import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateCoachingStarters = async (
  studentName: string, 
  coachName: string, 
  gradeLevel: string,
  sentenceStarter: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    
    // Get current date in professional format (e.g., "Monday, October 2, 2023")
    const today = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    let prompt = `You are an expert educational consultant and instructional coach. 
    Create a "Coaching Session Summary" document.

    Context:
    - Student: ${studentName}
    - Grade Level: ${gradeLevel}
    - Coach: ${coachName}
    - Date: ${today}
    - Primary Sentence Starter Used: "${sentenceStarter}"

    TASK:
    Provide a professional document containing sentence starters that the coach can use to quickly document the session.
    The document content and subsequent sentence starters should flow naturally from the primary opening: "${sentenceStarter}".
    For example, if the starter is about "Challenges", the document should focus on overcoming obstacles.
    
    FORMATTING RULES:
    1. DO NOT use asterisks (*).
    2. DO NOT use underscores (_____) or lines for blanks. Just provide the sentence starter text.
    3. Format it as a structured form/letter.
    4. Tone: Professional, constructive, and specific.

    Structure the document with these sections:
    1. Header (Date, Student, Coach, Focus)
    2. Session Opening (Include the primary starter: "${sentenceStarter}" and 2 related follow-ups)
    3. Observations & Student Input (Provide 3 distinct sentence starters relevant to the opening)
    4. Action Plan & Next Steps (Provide 3 distinct sentence starters relevant to the opening)
    5. Coach Signature Block
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    let text = response.text || "Failed to generate content.";

    // Post-processing to strictly remove any stray asterisks and underscores
    text = text.replace(/\*/g, '');
    text = text.replace(/_+/g, ''); // Remove all underscores/lines

    return text;
  } catch (error) {
    console.error("Error generating starters:", error);
    return "Error: Unable to generate content. Please check your connection.";
  }
};