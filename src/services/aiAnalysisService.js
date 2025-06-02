const { GoogleGenerativeAI } = require('@google/generative-ai');
const supabase = require('../config/database');

class AIAnalysisService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  }

  /**
   * Main function to trigger AI analysis for any profile update
   */
  async analyzeProfileData(userId, analysisType, profileData, triggerSource = 'profile_update') {
    try {
      console.log(`🔍 Starting AI analysis for user ${userId}, type: ${analysisType}`);
      
      // Create analysis session
      const session = await this.createAnalysisSession(userId, 'profile_update', `${analysisType}_profile_update`);
      
      // Create analysis trigger record
      await this.createAnalysisTrigger(userId, 'profile_update', triggerSource, profileData, session.id);
      
      // Get comprehensive user profile for context
      const userContext = await this.getUserContext(userId);
      
      // Perform specific analysis based on type
      let analysisResults = [];
      
      switch (analysisType) {
        case 'skin':
          analysisResults = await this.analyzeSkinProfile(userId, profileData, userContext, session.id);
          break;
        case 'hair':
          analysisResults = await this.analyzeHairProfile(userId, profileData, userContext, session.id);
          break;
        case 'lifestyle':
          analysisResults = await this.analyzeLifestyleProfile(userId, profileData, userContext, session.id);
          break;
        case 'health':
          analysisResults = await this.analyzeHealthProfile(userId, profileData, userContext, session.id);
          break;
        case 'makeup':
          analysisResults = await this.analyzeMakeupProfile(userId, profileData, userContext, session.id);
          break;
        case 'comprehensive':
          analysisResults = await this.performComprehensiveAnalysis(userId, userContext, session.id);
          break;
        default:
          throw new Error(`Unknown analysis type: ${analysisType}`);
      }
      
      // Complete the session
      await this.completeAnalysisSession(session.id, analysisResults);
      
      console.log(`✅ AI analysis completed for user ${userId}, generated ${analysisResults.length} insights`);
      return {
        sessionId: session.id,
        analysisResults,
        summary: await this.generateSessionSummary(analysisResults)
      };
      
    } catch (error) {
      console.error('AI Analysis Service Error:', error);
      throw error;
    }
  }

  /**
   * Analyze skin profile data - SINGLE API CALL with comprehensive analysis
   */
  async analyzeSkinProfile(userId, skinData, userContext, sessionId) {
    const analyses = [];
    
    // Single comprehensive skin analysis instead of multiple calls
    console.log('🤖 Performing single comprehensive skin analysis...');
    
    const comprehensiveAnalysis = await this.performAIAnalysis({
      type: 'comprehensive_skin_analysis',
      data: skinData,
      context: userContext,
      prompt: this.generateComprehensiveSkinPrompt(skinData, userContext)
    });
    
    // Save the comprehensive analysis
    analyses.push(await this.saveAnalysisResult(
      userId, 'skin', 'comprehensive_analysis', skinData, comprehensiveAnalysis, sessionId
    ));
    
    console.log('✅ Comprehensive skin analysis completed');
    return analyses;
  }

  /**
   * Analyze hair profile data - SINGLE API CALL
   */
  async analyzeHairProfile(userId, hairData, userContext, sessionId) {
    const analyses = [];
    
    console.log('🤖 Performing comprehensive hair analysis...');
    
    const comprehensiveAnalysis = await this.performAIAnalysis({
      type: 'comprehensive_hair_analysis',
      data: hairData,
      context: userContext,
      prompt: this.generateComprehensiveHairPrompt(hairData, userContext)
    });
    
    analyses.push(await this.saveAnalysisResult(
      userId, 'hair', 'comprehensive_analysis', hairData, comprehensiveAnalysis, sessionId
    ));
    
    console.log('✅ Comprehensive hair analysis completed');
    return analyses;
  }

  /**
   * Analyze lifestyle profile data - SINGLE API CALL
   */
  async analyzeLifestyleProfile(userId, lifestyleData, userContext, sessionId) {
    const analyses = [];
    
    console.log('🤖 Performing comprehensive lifestyle analysis...');
    
    const comprehensiveAnalysis = await this.performAIAnalysis({
      type: 'comprehensive_lifestyle_analysis',
      data: lifestyleData,
      context: userContext,
      prompt: this.generateComprehensiveLifestylePrompt(lifestyleData, userContext)
    });
    
    analyses.push(await this.saveAnalysisResult(
      userId, 'lifestyle', 'comprehensive_analysis', lifestyleData, comprehensiveAnalysis, sessionId
    ));
    
    console.log('✅ Comprehensive lifestyle analysis completed');
    return analyses;
  }

  /**
   * Analyze health profile data - SINGLE API CALL
   */
  async analyzeHealthProfile(userId, healthData, userContext, sessionId) {
    const analyses = [];
    
    console.log('🤖 Performing comprehensive health analysis...');
    
    const comprehensiveAnalysis = await this.performAIAnalysis({
      type: 'comprehensive_health_analysis',
      data: healthData,
      context: userContext,
      prompt: this.generateComprehensiveHealthPrompt(healthData, userContext)
    });
    
    analyses.push(await this.saveAnalysisResult(
      userId, 'health', 'comprehensive_analysis', healthData, comprehensiveAnalysis, sessionId
    ));
    
    console.log('✅ Comprehensive health analysis completed');
    return analyses;
  }

  /**
   * Analyze makeup profile data - SINGLE API CALL
   */
  async analyzeMakeupProfile(userId, makeupData, userContext, sessionId) {
    const analyses = [];
    
    console.log('🤖 Performing comprehensive makeup analysis...');
    
    const comprehensiveAnalysis = await this.performAIAnalysis({
      type: 'comprehensive_makeup_analysis',
      data: makeupData,
      context: userContext,
      prompt: this.generateComprehensiveMakeupPrompt(makeupData, userContext)
    });
    
    analyses.push(await this.saveAnalysisResult(
      userId, 'makeup', 'comprehensive_analysis', makeupData, comprehensiveAnalysis, sessionId
    ));
    
    console.log('✅ Comprehensive makeup analysis completed');
    return analyses;
  }

  /**
   * Perform comprehensive analysis across all profile data
   */
  async performComprehensiveAnalysis(userId, userContext, sessionId) {
    const analyses = [];
    
    // Holistic beauty profile analysis
    const holisticAnalysis = await this.performAIAnalysis({
      type: 'holistic_beauty_analysis',
      data: userContext,
      context: userContext,
      prompt: this.generateHolisticAnalysisPrompt(userContext)
    });
    
    analyses.push(await this.saveAnalysisResult(
      userId, 'comprehensive', 'holistic_analysis', userContext, holisticAnalysis, sessionId
    ));
    
    return analyses;
  }

  /**
   * Core AI analysis function using Gemini with rate limiting and retries
   */
  async performAIAnalysis({ type, data, context, prompt }) {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 AI Analysis attempt ${attempt}/${maxRetries} for ${type}`);
        
        // Add delay between API calls to respect rate limits
        if (attempt > 1) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const analysisText = response.text();
        
        // Extract JSON from markdown code blocks if present
        let cleanJson = analysisText;
        const jsonBlockMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
          cleanJson = jsonBlockMatch[1].trim();
        }
        
        // Try to parse as JSON, fallback to structured text
        let structuredResult;
        try {
          structuredResult = JSON.parse(cleanJson);
        } catch (parseError) {
          console.warn(`Failed to parse AI response as JSON: ${parseError.message}`);
          structuredResult = {
            analysis: analysisText,
            confidence: 0.8,
            recommendations: [],
            insights: [],
            parsing_error: parseError.message
          };
        }
        
        console.log(`✅ AI Analysis successful for ${type} on attempt ${attempt}`);
        return {
          ...structuredResult,
          model: 'gemini-2.0-flash',
          analysis_type: type,
          timestamp: new Date().toISOString()
        };
        
      } catch (error) {
        console.error(`❌ AI Analysis Error for ${type} (attempt ${attempt}):`, error.message);
        
        // If it's a rate limit error and we have retries left, continue
        if (error.status === 429 && attempt < maxRetries) {
          const retryDelay = error.errorDetails?.[2]?.retryDelay || '5s';
          const delayMs = retryDelay.includes('s') ? parseInt(retryDelay) * 1000 : 5000;
          console.log(`🕒 Rate limited. Waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        
        // If we've exhausted retries or it's not a rate limit error, return fallback
        console.warn(`⚠️  AI Analysis failed for ${type} after ${attempt} attempts. Using fallback.`);
        return this.generateFallbackAnalysis(type, data, context);
      }
    }
  }

  /**
   * Generate fallback analysis when AI service is unavailable
   */
  generateFallbackAnalysis(type, data, context) {
    console.log(`📝 Generating fallback analysis for ${type}`);
    
    const fallbackInsights = [
      "Profile data has been recorded successfully",
      "Detailed AI analysis will be available when service is restored",
      "Basic recommendations have been generated based on profile data"
    ];
    
    return {
      analysis: `Fallback analysis for ${type}. Your profile data has been saved and will be analyzed when the AI service is available.`,
      confidence: 0.6,
      recommendations: [],
      insights: fallbackInsights,
      model: 'fallback',
      analysis_type: type,
      timestamp: new Date().toISOString(),
      note: "This is a fallback analysis. Full AI analysis will be performed when service is restored."
    };
  }

  /**
   * Generate comprehensive skin analysis prompt (combines all skin analysis in one call)
   */
  generateComprehensiveSkinPrompt(skinData, userContext) {
    return `
As an expert dermatologist and beauty consultant, provide a comprehensive analysis of this user's skin profile.

User Context:
- Age: ${userContext.age || 'Not specified'}
- Gender: ${userContext.gender || 'Not specified'}
- Location: ${userContext.location || 'Not specified'}
- Climate: ${userContext.climate || 'Not specified'}

Skin Profile Data:
${JSON.stringify(skinData, null, 2)}

IMPORTANT: Respond with ONLY valid JSON. Do not include any markdown formatting, code blocks, or explanatory text. Return just the raw JSON object.

Provide a complete analysis in the following JSON format:
{
  "skin_type_assessment": {
    "confirmed_type": "${skinData.skin_type || 'unknown'}",
    "confidence": 0.85,
    "reasoning": "Analysis based on user input and profile data"
  },
  "fitzpatrick_analysis": {
    "phototype": ${skinData.fitzpatrick_phototype || 3},
    "sun_sensitivity": "medium",
    "uv_protection_recommendations": ["Use SPF 30+ daily", "Seek shade during peak hours"]
  },
  "concern_analysis": [
    ${skinData.primary_concerns ? skinData.primary_concerns.map(concern => `{
      "concern": "${concern}",
      "severity": "moderate",
      "treatment_priority": 2,
      "recommended_ingredients": ["niacinamide", "salicylic acid"],
      "timeline": "6-12 weeks for improvement"
    }`).join(',') : ''}
  ],
  "essential_products": [
    {
      "category": "cleanser",
      "product_type": "gentle foam cleanser",
      "key_ingredients": ["salicylic acid", "niacinamide"],
      "usage": "twice daily",
      "priority": 1
    },
    {
      "category": "moisturizer", 
      "product_type": "lightweight gel moisturizer",
      "key_ingredients": ["hyaluronic acid", "ceramides"],
      "usage": "twice daily",
      "priority": 1
    },
    {
      "category": "sunscreen",
      "product_type": "broad spectrum SPF 30+",
      "key_ingredients": ["zinc oxide", "titanium dioxide"],
      "usage": "daily morning",
      "priority": 1
    }
  ],
  "routine_recommendations": {
    "morning": ["Gentle cleanser", "Moisturizer", "Sunscreen"],
    "evening": ["Cleanser", "Treatment (if any)", "Moisturizer"],
    "weekly": ["Gentle exfoliation 1-2x"]
  },
  "ingredients_to_avoid": ${JSON.stringify(skinData.sensitivities_allergies || [])},
  "environmental_considerations": "Adjust routine based on ${userContext.climate || 'local'} climate conditions",
  "confidence_score": 0.85,
  "key_insights": [
    "Skin type confirmed as ${skinData.skin_type || 'combination'}",
    "Primary concerns identified and prioritized",
    "Customized routine recommended"
  ],
  "recommendations": [
    {
      "title": "Daily Skincare Routine",
      "description": "Follow a consistent morning and evening routine",
      "priority": 1
    },
    {
      "title": "Sun Protection",
      "description": "Use broad spectrum SPF daily",
      "priority": 1
    }
  ]
}
`;
  }

  /**
   * Generate skin type analysis prompt (legacy - keeping for compatibility)
   */
  generateSkinTypePrompt(skinData, userContext) {
    return `
As an expert dermatologist and beauty consultant, analyze this user's skin profile data and provide comprehensive insights.

User Context:
- Age: ${userContext.age || 'Not specified'}
- Gender: ${userContext.gender || 'Not specified'}
- Location: ${userContext.location || 'Not specified'}
- Climate: ${userContext.climate || 'Not specified'}

Skin Profile Data:
${JSON.stringify(skinData, null, 2)}

Please provide a detailed analysis in the following JSON format:
{
  "skin_type_assessment": {
    "confirmed_type": "string",
    "confidence": 0.0-1.0,
    "reasoning": "detailed explanation"
  },
  "fitzpatrick_analysis": {
    "phototype": 1-6,
    "sun_sensitivity": "low/medium/high",
    "recommendations": ["UV protection advice"]
  },
  "concern_prioritization": [
    {
      "concern": "concern_name",
      "severity": "low/medium/high",
      "urgency": "immediate/short-term/long-term",
      "treatment_approach": "detailed approach"
    }
  ],
  "ingredient_recommendations": {
    "beneficial": ["ingredient1", "ingredient2"],
    "avoid": ["ingredient1", "ingredient2"],
    "reasoning": "explanation"
  },
  "routine_suggestions": {
    "morning": ["step1", "step2"],
    "evening": ["step1", "step2"],
    "weekly": ["special treatments"]
  },
  "environmental_considerations": {
    "climate_adjustments": "advice based on location/climate",
    "seasonal_changes": "how to adjust routine"
  },
  "confidence_score": 0.0-1.0,
  "key_insights": ["insight1", "insight2"],
  "next_steps": ["actionable recommendations"]
}
`;
  }

  generateSkinConcernsPrompt(skinData, userContext) {
    return `
As a dermatology expert, analyze the specific skin concerns mentioned by this user and provide targeted solutions.

User Profile: Age ${userContext.age}, ${userContext.gender}, Location: ${userContext.location}

Skin Concerns: ${JSON.stringify(skinData.primary_concerns)}
Skin Type: ${skinData.skin_type}
Sensitivities: ${JSON.stringify(skinData.sensitivities_allergies)}

Provide analysis in JSON format:
{
  "concern_analysis": [
    {
      "concern": "concern_name",
      "severity_assessment": "mild/moderate/severe",
      "likely_causes": ["cause1", "cause2"],
      "treatment_priority": 1-5,
      "expected_timeline": "time to see results",
      "specific_ingredients": ["active ingredients"],
      "product_types": ["cleanser", "serum", etc.],
      "lifestyle_factors": ["factors affecting this concern"]
    }
  ],
  "treatment_plan": {
    "immediate_actions": ["step1", "step2"],
    "short_term_goals": "1-3 months",
    "long_term_goals": "3+ months",
    "monitoring_advice": "how to track progress"
  },
  "product_recommendations": [
    {
      "category": "product_type",
      "specific_suggestions": ["product descriptions"],
      "ingredient_focus": ["key ingredients"],
      "usage_instructions": "how to use"
    }
  ],
  "confidence_score": 0.0-1.0
}
`;
  }

  generateSkincareRecommendationsPrompt(skinData, userContext) {
    return `
Create personalized skincare product recommendations for this user based on their complete profile.

User: ${userContext.age}yr ${userContext.gender} in ${userContext.location}
Skin: ${skinData.skin_type} skin, tone: ${skinData.skin_tone}, undertone: ${skinData.undertone}
Concerns: ${JSON.stringify(skinData.primary_concerns)}
Sensitivities: ${JSON.stringify(skinData.sensitivities_allergies)}
Sun exposure: ${skinData.sun_exposure_habits}

Provide recommendations in JSON format:
{
  "essential_products": [
    {
      "category": "cleanser/moisturizer/sunscreen/treatment",
      "product_type": "specific type",
      "key_ingredients": ["ingredient1", "ingredient2"],
      "product_description": "what to look for",
      "usage": "when and how to use",
      "priority": 1-5,
      "budget_options": ["affordable alternatives"],
      "premium_options": ["high-end recommendations"]
    }
  ],
  "routine_structure": {
    "morning": {
      "steps": ["step1", "step2"],
      "time_required": "X minutes",
      "key_focus": "protection/hydration/etc"
    },
    "evening": {
      "steps": ["step1", "step2"], 
      "time_required": "X minutes",
      "key_focus": "repair/treatment/etc"
    },
    "weekly_treatments": ["masks", "exfoliation"]
  },
  "ingredient_guidance": {
    "start_with": ["beginner-friendly ingredients"],
    "introduce_gradually": ["potent actives"],
    "never_combine": ["conflicting ingredients"],
    "seasonal_adjustments": "how to modify"
  },
  "shopping_priorities": [
    {
      "item": "product category",
      "urgency": "immediate/soon/future",
      "reasoning": "why this is priority"
    }
  ],
  "confidence_score": 0.0-1.0
}
`;
  }

  /**
   * Generate comprehensive hair analysis prompt
   */
  generateComprehensiveHairPrompt(hairData, userContext) {
    return `
As a hair care expert, provide comprehensive analysis of this user's hair profile.

User: ${userContext.age}yr ${userContext.gender} in ${userContext.location}
Hair Data: ${JSON.stringify(hairData, null, 2)}

IMPORTANT: Respond with ONLY valid JSON. Do not include any markdown formatting, code blocks, or explanatory text. Return just the raw JSON object.

Provide complete analysis in JSON format:
{
  "hair_type_assessment": {
    "pattern": "${hairData.hair_pattern || 'wavy'}",
    "texture": "${hairData.hair_texture || 'medium'}",
    "density": "${hairData.hair_density || 'medium'}",
    "porosity": "${hairData.hair_porosity || 'normal'}"
  },
  "scalp_analysis": {
    "condition": "${hairData.scalp_condition || 'normal'}",
    "recommendations": ["gentle cleansing", "regular scalp massage"]
  },
  "essential_products": [
    {
      "category": "shampoo",
      "product_type": "sulfate-free gentle shampoo",
      "usage": "2-3 times per week",
      "priority": 1
    },
    {
      "category": "conditioner",
      "product_type": "moisturizing conditioner",
      "usage": "every wash",
      "priority": 1
    }
  ],
  "routine_recommendations": {
    "weekly": ["Shampoo 2-3x", "Deep condition 1x", "Hair mask 1x"],
    "daily": ["Gentle brushing", "Heat protection if styling"]
  },
  "styling_tips": ["Use heat protectant", "Air dry when possible"],
  "ingredients_to_focus": ["argan oil", "keratin", "biotin"],
  "confidence_score": 0.8,
  "key_insights": ["Hair type confirmed", "Scalp health assessed", "Care routine customized"],
  "recommendations": [
    {
      "title": "Gentle Hair Care Routine",
      "description": "Use sulfate-free products and minimize heat styling",
      "priority": 1
    }
  ]
}
`;
  }

  generateHairTypePrompt(hairData, userContext) {
    return `
Analyze this user's hair profile and provide expert recommendations.

User: ${userContext.age}yr ${userContext.gender} in ${userContext.location}
Hair Data: ${JSON.stringify(hairData, null, 2)}

Provide JSON analysis with hair type confirmation, care recommendations, and product suggestions.
Focus on: texture analysis, porosity assessment, scalp health, styling recommendations, ingredient suggestions.
`;
  }

  generateHaircareRecommendationsPrompt(hairData, userContext) {
    return `
Create personalized haircare product recommendations.

Hair Type: ${hairData.hair_pattern}, ${hairData.hair_texture}
Concerns: ${JSON.stringify(hairData.hair_concerns)}
Scalp: ${hairData.scalp_condition}

Provide JSON with: essential products, routine structure, ingredient guidance, styling tips.
`;
  }

  /**
   * Generate comprehensive lifestyle analysis prompt
   */
  generateComprehensiveLifestylePrompt(lifestyleData, userContext) {
    return `
Analyze this user's lifestyle and environmental factors affecting skin and hair health.

User: ${userContext.age}yr ${userContext.gender}
Location: ${lifestyleData.location || 'Not specified'}
Lifestyle Data: ${JSON.stringify(lifestyleData, null, 2)}

IMPORTANT: Respond with ONLY valid JSON. Do not include any markdown formatting, code blocks, or explanatory text. Return just the raw JSON object.

Provide comprehensive analysis in JSON format:
{
  "environmental_impact": {
    "climate_effects": "Analysis of climate impact on skin/hair",
    "pollution_protection": ["Use antioxidant serums", "Cleanse thoroughly"],
    "seasonal_adjustments": "Adapt routine for weather changes"
  },
  "lifestyle_recommendations": {
    "diet": ["Increase omega-3 intake", "Stay hydrated", "Antioxidant-rich foods"],
    "sleep": "7-9 hours nightly for skin regeneration",
    "stress_management": ["Regular exercise", "Meditation", "Skincare as self-care"],
    "exercise": "Regular activity improves circulation and skin health"
  },
  "protective_measures": ["Daily sunscreen", "Pollution barrier creams"],
  "confidence_score": 0.8,
  "key_insights": ["Environmental factors identified", "Lifestyle adjustments recommended"],
  "recommendations": [
    {
      "title": "Environmental Protection",
      "description": "Protect skin and hair from environmental stressors",
      "priority": 1
    }
  ]
}
`;
  }

  /**
   * Generate comprehensive health analysis prompt
   */
  generateComprehensiveHealthPrompt(healthData, userContext) {
    return `
Analyze how health conditions affect skin and hair, provide safe recommendations.

User: ${userContext.age}yr ${userContext.gender}
Health Data: ${JSON.stringify(healthData, null, 2)}

IMPORTANT: Respond with ONLY valid JSON. Do not include any markdown formatting, code blocks, or explanatory text. Return just the raw JSON object.

Provide analysis in JSON format:
{
  "health_impact_assessment": {
    "skin_effects": "How conditions affect skin health",
    "hair_effects": "How conditions affect hair health",
    "medication_considerations": "Effects of medications on skin/hair"
  },
  "safe_ingredients": ["gentle", "hypoallergenic", "dermatologist-tested"],
  "ingredients_to_avoid": ["harsh actives", "fragrances"],
  "professional_consultation": "Recommend dermatologist consultation for specific conditions",
  "confidence_score": 0.75,
  "key_insights": ["Health factors assessed", "Safe product guidance provided"],
  "recommendations": [
    {
      "title": "Gentle Care Approach",
      "description": "Use gentle, hypoallergenic products",
      "priority": 1
    }
  ]
}
`;
  }

  /**
   * Generate comprehensive makeup analysis prompt
   */
  generateComprehensiveMakeupPrompt(makeupData, userContext) {
    return `
Create personalized makeup recommendations based on user profile.

User: ${userContext.age}yr ${userContext.gender}
Skin tone: ${userContext.skin_tone || 'medium'}, undertone: ${userContext.undertone || 'warm'}
Makeup Data: ${JSON.stringify(makeupData, null, 2)}

IMPORTANT: Respond with ONLY valid JSON. Do not include any markdown formatting, code blocks, or explanatory text. Return just the raw JSON object.

Provide recommendations in JSON format:
{
  "color_matching": {
    "foundation_shade": "Match to skin tone and undertone",
    "concealer": "One shade lighter than foundation",
    "blush": "Complement natural flush",
    "lipstick": "Colors that enhance undertone"
  },
  "product_recommendations": [
    {
      "category": "foundation",
      "recommendations": ["Medium coverage", "Matches undertone"],
      "priority": 1
    }
  ],
  "application_tips": ["Use primer", "Blend well", "Set with powder"],
  "look_suggestions": ["Natural day look", "Evening glam"],
  "confidence_score": 0.8,
  "key_insights": ["Color palette customized", "Application guidance provided"],
  "recommendations": [
    {
      "title": "Color-Matched Makeup",
      "description": "Use colors that complement your skin tone",
      "priority": 1
    }
  ]
}
`;
  }

  generateEnvironmentalImpactPrompt(lifestyleData, userContext) {
    return `
Analyze how this user's environment and lifestyle affects their skin and hair.

Location: ${lifestyleData.location}
Climate: ${lifestyleData.climate}
Pollution: ${lifestyleData.pollution_exposure}
Lifestyle: ${JSON.stringify(lifestyleData, null, 2)}

Provide JSON analysis of environmental impacts and protective measures.
`;
  }

  generateLifestyleRecommendationsPrompt(lifestyleData, userContext) {
    return `
Provide lifestyle recommendations to improve skin and hair health.

Current lifestyle: ${JSON.stringify(lifestyleData, null, 2)}

Provide JSON with: diet suggestions, sleep optimization, stress management, exercise recommendations.
`;
  }

  generateHealthImpactPrompt(healthData, userContext) {
    return `
Analyze how health conditions affect skin and hair, provide safe recommendations.

Health data: ${JSON.stringify(healthData, null, 2)}

Provide JSON analysis focusing on: condition impacts, safe ingredients, consultation recommendations.
`;
  }

  generateMakeupRecommendationsPrompt(makeupData, userContext) {
    return `
Create personalized makeup recommendations.

Skin tone: ${userContext.skin_tone}, undertone: ${userContext.undertone}
Preferences: ${JSON.stringify(makeupData, null, 2)}

Provide JSON with: color matching, product recommendations, application tips, look suggestions.
`;
  }

  generateHolisticAnalysisPrompt(userContext) {
    return `
Provide a comprehensive beauty and wellness analysis based on all available user data.

Complete user profile: ${JSON.stringify(userContext, null, 2)}

IMPORTANT: Respond with ONLY valid JSON. Do not include any markdown formatting, code blocks, or explanatory text. Return just the raw JSON object.

Provide JSON with: overall assessment, interconnected factors, holistic recommendations, lifestyle integration.
`;
  }

  /**
   * Helper functions for database operations
   */
  async createAnalysisSession(userId, sessionType, triggerAction) {
    const { data, error } = await supabase
      .from('ai_analysis_sessions')
      .insert({
        user_id: userId,
        session_type: sessionType,
        trigger_action: triggerAction,
        status: 'processing'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createAnalysisTrigger(userId, triggerType, triggerSource, triggerData, sessionId) {
    const { data, error } = await supabase
      .from('ai_analysis_triggers')
      .insert({
        user_id: userId,
        trigger_type: triggerType,
        trigger_source: triggerSource,
        trigger_data: triggerData,
        analysis_session_id: sessionId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async saveAnalysisResult(userId, analysisType, category, inputData, analysisResult, sessionId) {
    const { data, error } = await supabase
      .from('ai_analysis_results')
      .insert({
        user_id: userId,
        analysis_type: analysisType,
        category: category,
        input_data: inputData,
        analysis_result: analysisResult,
        confidence_score: analysisResult.confidence_score || 0.8,
        recommendations: analysisResult.recommendations || [],
        insights: analysisResult.insights || analysisResult.key_insights || [],
        metadata: {
          session_id: sessionId,
          model: 'gemini-2.0-flash',
          processing_time: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (error) throw error;

    // Create individual recommendations
    if (analysisResult.recommendations || analysisResult.product_recommendations) {
      await this.createRecommendations(userId, data.id, analysisType, analysisResult);
    }

    return data;
  }

  async createRecommendations(userId, analysisResultId, category, analysisResult) {
    const recommendations = analysisResult.recommendations || 
                          analysisResult.product_recommendations || 
                          analysisResult.essential_products || [];

    if (!Array.isArray(recommendations)) return;

    for (const rec of recommendations) {
      await supabase
        .from('ai_recommendations')
        .insert({
          user_id: userId,
          analysis_result_id: analysisResultId,
          recommendation_type: rec.category || 'general',
          category: category,
          title: rec.title || rec.product_type || rec.item || 'Recommendation',
          description: rec.description || rec.reasoning || rec.product_description,
          recommendation_data: rec,
          priority: rec.priority || 2,
          confidence_score: rec.confidence || 0.8
        });
    }
  }

  async completeAnalysisSession(sessionId, analysisResults) {
    const sessionSummary = {
      total_analyses: analysisResults.length,
      categories_analyzed: [...new Set(analysisResults.map(r => r.analysis_type))],
      overall_confidence: analysisResults.reduce((avg, r) => avg + (r.confidence_score || 0.8), 0) / analysisResults.length,
      key_findings: analysisResults.map(r => r.category).join(', ')
    };

    await supabase
      .from('ai_analysis_sessions')
      .update({
        status: 'completed',
        completed_analyses: analysisResults.length,
        total_analyses: analysisResults.length,
        session_summary: sessionSummary
      })
      .eq('id', sessionId);
  }

  async generateSessionSummary(analysisResults) {
    return {
      total_insights: analysisResults.length,
      categories: [...new Set(analysisResults.map(r => r.analysis_type))],
      confidence: analysisResults.reduce((avg, r) => avg + (r.confidence_score || 0.8), 0) / analysisResults.length,
      timestamp: new Date().toISOString()
    };
  }

  async getUserContext(userId) {
    // Get complete user profile for analysis context
    const { data: user } = await supabase
      .from('users')
      .select(`
        *,
        skin_profiles(*),
        hair_profiles(*),
        lifestyle_demographics(*),
        health_medical_conditions(*),
        makeup_preferences(*)
      `)
      .eq('id', userId)
      .single();

    return {
      ...user,
      age: user.date_of_birth ? new Date().getFullYear() - new Date(user.date_of_birth).getFullYear() : null,
      skin_tone: user.skin_profiles?.[0]?.skin_tone,
      undertone: user.skin_profiles?.[0]?.undertone,
      location: user.lifestyle_demographics?.[0]?.location,
      climate: user.lifestyle_demographics?.[0]?.climate
    };
  }

  /**
   * Get user's AI analysis history
   */
  async getUserAnalysisHistory(userId, analysisType = null, limit = 10) {
    let query = supabase
      .from('ai_analysis_results')
      .select(`
        *,
        ai_recommendations(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (analysisType) {
      query = query.eq('analysis_type', analysisType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Get active recommendations for user
   */
  async getActiveRecommendations(userId, category = null) {
    let query = supabase
      .from('ai_recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('priority')
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
}

module.exports = new AIAnalysisService(); 