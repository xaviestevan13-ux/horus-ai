import {GoogleGenAI, Type} from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AnalysisResult {
  isBlurry: boolean;
  blurReason?: string;
  isHPProduct: boolean;
  matchesModel: boolean;
  mismatchReason?: string;
  errors: {
    type: string;
    description: string;
    repairCost: number;
    imageIndex: number;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }[];
  overallHealth: "Excellent" | "Good" | "Fair" | "Poor";
  summary: string;
  totalRepairCost: number;
  estimatedResaleValue: number;
  originalPrice: number;
  estimatedRemainingLifeYears: number;
  recommendation: {
    action: "Repair" | "Sell As-Is" | "Recycle";
    reasoning: string;
  };
}

export interface SitePrintAnalysisResult {
  isBlurry: boolean;
  blurReason?: string;
  isHPProduct: boolean;
  componentType: "Inkjet" | "Unknown";
  condition: "Excellent" | "Good" | "Fair" | "Worn" | "Critical";
  wearLevel: number; // 0-100 (For inkjet, this is clog/wear level)
  estimatedRemainingLifeYears: number;
  repairNeeded: boolean;
  repairTimeline?: string;
  devaluationPercentage: number;
  summary: string;
  manualRepairRecommendations: string[];
  detectedIssues: {
    type: string;
    description: string;
    severity: "Low" | "Medium" | "High";
  }[];
}

export async function analyzeLaptopImage(base64Images: string[], model: string, feedbackContext?: string): Promise<AnalysisResult> {
  const modelName = "gemini-3-flash-preview";
  
  const prompt = `
    You are an expert HP hardware diagnostic and refurbishment AI, known as Horus AI. 
    Analyze the provided images of an HP laptop (Model: ${model}). 
    Multiple images are provided showing different angles of the SAME device. 
    Combine your findings into a single comprehensive report.
    
    ${feedbackContext ? `PREVIOUS FEEDBACK TO LEARN FROM:\n${feedbackContext}\nUse this feedback to avoid repeating past mistakes and improve accuracy.` : ""}
    
    Focus on external issues: outer shell damage, screen cracks/pixels, and keyboard defects (missing keys, worn labels).
    
    1. Check if the images are blurry or too dark to analyze.
    2. Verify if the product in the images is an HP laptop.
    3. Verify if the laptop model in the images corresponds to "${model}".
    4. CRITICAL: If the product is NOT an HP product or does NOT match the selected model, set isHPProduct or matchesModel to false, provide a mismatchReason, and STOP the analysis. Do not provide errors, health, or pricing for non-HP products.
    5. If clear and valid HP product, detect all visible external errors across ALL images.
    6. For each error, provide its bounding box coordinates in normalized format (0-1000) relative to the image it was found in. 
       Also provide the 0-based imageIndex indicating which image the error was found in.
       The coordinates should be [ymin, xmin, ymax, xmax] but mapped to the JSON structure:
       x: xmin, y: ymin, width: (xmax - xmin), height: (ymax - ymin).
    7. For each error, estimate a realistic repair cost in USD. 
       Use the following model-specific reference prices (converted from EUR to USD) as a guide for common parts:
       
       HP OMEN:
       - Keyboard/Top Cover: $120 - $180
       - LCD Back Cover: $130
       - Base/Chassis: $120
       
       HP ZBOOK:
       - Palmrest w/ Keyboard: $100 - $135
       - LCD Screen: $155 - $190
       - LCD Back Cover: $220
       - Chassis: $140
       
       HP PROBOOK:
       - Keyboard: $30 - $60
       - LCD Screen: $65 - $70
       - LCD + Back Cover: $90
       - Palmrest: $90 - $95
       - Bottom Case: $50
       
       HP ENVY:
       - Keyboard/Palmrest: $65 - $135
       - LCD Back Cover: $35 - $45
       - Display Assembly (Touch): $115 - $125
       - Base Enclosure: $115 - $130
       
       HP SPECTRE x360:
       - Keyboard: $50
       - LCD + Touch: $135 - $175
       - Chassis: $80 - $145
       
       HP VICTUS:
       - Keyboard: $45 - $210
       - LCD Screen: $215
       - LCD Back Cover: $95 - $135
       - Top Cover + Keyboard: $220 - $270
       
       HP PAVILION:
       - Keyboard: $20 - $35
       - LCD Back Cover: $140 - $185
       - LCD Bezel: $145 - $150
       
       HP ELITEBOOK:
       - Keyboard: $45 - $155
       - LCD Display Assembly: $165
       - LCD Back Cover: $40
       
       Note: These are approximations and may vary by specific model version.
       Keyboard Repair Note: The prices above refer to a full keyboard/top-cover replacement. For a single missing or damaged key, estimate the repair cost at approximately $5 per key.
    8. Provide an overall health assessment for the device.
    9. Calculate the total repair cost by summing all individual error costs.
    10. Provide an approximation of the price that the laptop could be resold for in a refurbishment market after these repairs are completed, considering the specific model: ${model}.
    11. Estimate the original retail price of this laptop model (${model}) when it was new.
    12. Estimate the remaining useful life in years. Take into account that the total useful life for a new HP product is 10 years.
    13. Provide a recommendation: Should the user "Repair" it, "Sell As-Is", or "Recycle" it? Base this on the repair cost vs. resale value vs. original price. Provide a brief reasoning.
    
    Return the result strictly in JSON format.
  `;

  const imageParts = base64Images.map(base64 => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: base64.split(",")[1] || base64,
    },
  }));

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        parts: [
          { text: prompt },
          ...imageParts
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isBlurry: { type: Type.BOOLEAN },
          blurReason: { type: Type.STRING },
          isHPProduct: { type: Type.BOOLEAN, description: "True if the images contain an HP product" },
          matchesModel: { type: Type.BOOLEAN, description: "True if the product matches the selected model" },
          mismatchReason: { type: Type.STRING, description: "Reason why it is not HP or doesn't match model" },
          errors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                description: { type: Type.STRING },
                repairCost: { type: Type.NUMBER, description: "Estimated repair cost in USD" },
                imageIndex: { type: Type.NUMBER, description: "0-based index of the image containing this error" },
                coordinates: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER, description: "Left coordinate (0-1000)" },
                    y: { type: Type.NUMBER, description: "Top coordinate (0-1000)" },
                    width: { type: Type.NUMBER, description: "Width (0-1000)" },
                    height: { type: Type.NUMBER, description: "Height (0-1000)" },
                  },
                  required: ["x", "y", "width", "height"],
                },
              },
              required: ["type", "description", "repairCost", "imageIndex", "coordinates"],
            },
          },
          overallHealth: { type: Type.STRING, enum: ["Excellent", "Good", "Fair", "Poor"] },
          summary: { type: Type.STRING },
          totalRepairCost: { type: Type.NUMBER, description: "Sum of all repair costs in USD" },
          estimatedResaleValue: { type: Type.NUMBER, description: "Estimated resale value after refurbishment in USD" },
          originalPrice: { type: Type.NUMBER, description: "Estimated original retail price in USD" },
          estimatedRemainingLifeYears: { type: Type.NUMBER, description: "Estimated remaining useful life in years" },
          recommendation: {
            type: Type.OBJECT,
            properties: {
              action: { type: Type.STRING, enum: ["Repair", "Sell As-Is", "Recycle"] },
              reasoning: { type: Type.STRING },
            },
            required: ["action", "reasoning"],
          },
        },
        required: ["isBlurry", "isHPProduct", "matchesModel", "errors", "overallHealth", "summary", "totalRepairCost", "estimatedResaleValue", "originalPrice", "estimatedRemainingLifeYears", "recommendation"],
      },
    },
  });

  try {
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    const parsed = JSON.parse(text);
    
    // Ensure required fields exist with defaults if missing
    return {
      isBlurry: !!parsed.isBlurry,
      blurReason: parsed.blurReason || "",
      isHPProduct: !!parsed.isHPProduct,
      matchesModel: !!parsed.matchesModel,
      mismatchReason: parsed.mismatchReason || "",
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      overallHealth: parsed.overallHealth || "Good",
      summary: parsed.summary || "No summary provided.",
      totalRepairCost: typeof parsed.totalRepairCost === 'number' ? parsed.totalRepairCost : 0,
      estimatedResaleValue: typeof parsed.estimatedResaleValue === 'number' ? parsed.estimatedResaleValue : 0,
      originalPrice: typeof parsed.originalPrice === 'number' ? parsed.originalPrice : 0,
      estimatedRemainingLifeYears: typeof parsed.estimatedRemainingLifeYears === 'number' ? parsed.estimatedRemainingLifeYears : 5,
      recommendation: parsed.recommendation || { action: "Repair", reasoning: "No reasoning provided." }
    };
  } catch (err) {
    console.error("Failed to parse laptop analysis JSON:", err);
    throw new Error("The AI provided an invalid response format. Please try again.");
  }
}

export async function analyzeSitePrintComponent(base64Images: string[], feedbackContext?: string): Promise<SitePrintAnalysisResult> {
  const modelName = "gemini-3-flash-preview";
  
  const prompt = `
    You are an expert HP SitePrint maintenance AI, known as Horus AI. 
    Analyze the provided images of an HP SitePrint robot's external inkjet part.
    Multiple images are provided showing different angles of the SAME inkjet component.
    
    ${feedbackContext ? `PREVIOUS FEEDBACK TO LEARN FROM:\n${feedbackContext}\nUse this feedback to avoid repeating past mistakes and improve accuracy.` : ""}
    
    Your goal is to distinguish between a NEW/HEALTHY inkjet part and a DAMAGED/WORN one.
    
    1. Verify if the images contain an HP SitePrint inkjet component.
    2. CRITICAL: If the product is NOT an HP SitePrint inkjet component, set isHPProduct to false and STOP the analysis.
    3. Identify the component type: "Inkjet" or "Unknown".
    4. Check if the images are blurry or too dark.
    5. Assess the condition (Excellent, Good, Fair, Worn, Critical).
       - "Excellent": Looks brand new, no ink residue, no scratches, perfect nozzle alignment.
       - "Good": Minor ink residue, light surface scratches, but fully functional.
       - "Fair": Visible ink buildup, moderate wear on the housing.
       - "Worn": Heavy ink clogs, visible damage to the external casing, needs cleaning or minor repair.
       - "Critical": Physical cracks, missing parts, or severe clogs that prevent operation.
    6. Estimate the wear/clog level as a percentage (0-100). 0% is brand new, 100% is completely unusable.
    7. Estimate the remaining useful life in years. Total useful life for a new HP product is 10 years.
    8. Determine if a repair/maintenance is needed now and provide a timeline.
    9. Estimate the devaluation percentage of the inkjet system due to its current state.
    10. List specific detected issues across ALL images. Look for:
        - Nozzle clogs (dried ink on the printhead area)
        - Ink leaks (residue on the external housing)
        - Debris/Dust buildup
        - External physical damage (cracks, dents, scratches)
        - Missing or loose components
        - Nozzle plate scratches (fine lines on the metal surface)
        - Ink buildup on sensors (optical windows or contact points)
    11. Provide specific manual repair recommendations for the detected inkjet problems. 
        Examples: "Wash manually with isopropyl alcohol", "Clean with distilled water", "Perform an ink purge", "Gently wipe nozzle with lint-free cloth", "Clear sensor window with compressed air".
    
    Return the result strictly in JSON format.
  `;

  const imageParts = base64Images.map(base64 => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: base64.split(",")[1] || base64,
    },
  }));

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        parts: [
          { text: prompt },
          ...imageParts
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isBlurry: { type: Type.BOOLEAN },
          blurReason: { type: Type.STRING },
          isHPProduct: { type: Type.BOOLEAN, description: "True if the images contain an HP SitePrint component" },
          componentType: { type: Type.STRING, enum: ["Inkjet", "Unknown"] },
          condition: { type: Type.STRING, enum: ["Excellent", "Good", "Fair", "Worn", "Critical"] },
          wearLevel: { type: Type.NUMBER, description: "Wear or clog percentage 0-100" },
          estimatedRemainingLifeYears: { type: Type.NUMBER },
          repairNeeded: { type: Type.BOOLEAN },
          repairTimeline: { type: Type.STRING },
          devaluationPercentage: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          manualRepairRecommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Step-by-step manual repair or cleaning instructions"
          },
          detectedIssues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                description: { type: Type.STRING },
                severity: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
              },
              required: ["type", "description", "severity"],
            },
          },
        },
        required: ["isBlurry", "isHPProduct", "componentType", "condition", "wearLevel", "estimatedRemainingLifeYears", "repairNeeded", "devaluationPercentage", "summary", "manualRepairRecommendations", "detectedIssues"],
      },
    },
  });

  try {
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    const parsed = JSON.parse(text);
    
    return {
      isBlurry: !!parsed.isBlurry,
      blurReason: parsed.blurReason || "",
      isHPProduct: !!parsed.isHPProduct,
      componentType: parsed.componentType || "Unknown",
      condition: parsed.condition || "Good",
      wearLevel: typeof parsed.wearLevel === 'number' ? parsed.wearLevel : 0,
      estimatedRemainingLifeYears: typeof parsed.estimatedRemainingLifeYears === 'number' ? parsed.estimatedRemainingLifeYears : 5,
      repairNeeded: !!parsed.repairNeeded,
      repairTimeline: parsed.repairTimeline || "",
      devaluationPercentage: typeof parsed.devaluationPercentage === 'number' ? parsed.devaluationPercentage : 0,
      summary: parsed.summary || "No summary provided.",
      manualRepairRecommendations: Array.isArray(parsed.manualRepairRecommendations) ? parsed.manualRepairRecommendations : [],
      detectedIssues: Array.isArray(parsed.detectedIssues) ? parsed.detectedIssues : []
    };
  } catch (err) {
    console.error("Failed to parse SitePrint analysis JSON:", err);
    throw new Error("The AI provided an invalid response format. Please try again.");
  }
}

export async function getSupportResponse(message: string, context?: string): Promise<string> {
  const modelName = "gemini-3-flash-preview";
  const prompt = `
    You are an expert HP Support AI assistant, known as Horus AI. 
    You help users with their HP laptops and HP SitePrint robots.
    Context about the current situation: ${context || "No specific context provided."}
    
    Reference HP Part Prices (USD approx):
    - LCD Back Cover: $35 - $220 (model dependent)
    - Display Bezel: $15 - $150
    - Keyboard (Full Replacement): $20 - $210 (model dependent)
    - Single Key Repair: $5 per key
    - Bottom Enclosure: $45 - $145
    - Webcam: $50 - $65
    
    User question: ${message}
    
    Provide a helpful, professional, and concise response. 
    If you don't know the answer, suggest contacting official HP support.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        parts: [
          { text: prompt },
        ],
      },
    ],
  });

  return response.text || "I'm sorry, I couldn't generate a response. Please try again.";
}
