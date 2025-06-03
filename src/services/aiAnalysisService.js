const { GoogleGenerativeAI } = require('@google/generative-ai');
const supabase = require('../config/database');
const AIAnalysisCacheService = require('./aiAnalysisCacheService');
const Logger = require('../utils/logger');

class AIAnalysisService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    this.cacheService = new AIAnalysisCacheService();
  }

  /**
   * Main function to trigger AI analysis for any profile update with caching
   */
  async analyzeProfileData(userId, analysisType, profileData, triggerSource = 'profile_update') {
    try {
      Logger.info(`Starting AI analysis for user ${userId}`, { analysisType });
      
      // Get comprehensive user profile for context first
      const userContext = await this.getUserContext(userId);
      
      // Use cache service to get or generate analysis
      const cacheKey = `${analysisType}_analysis`;
      const analysisResult = await this.cacheService.getOrGenerate(
        userId, 
        cacheKey, 
        { ...profileData, userContext }, 
        async () => {
          // This function will only be called if cache miss
          Logger.info(`Generating new ${analysisType} analysis`, { reason: 'cache_miss' });
          
          // Create analysis session only if generating new analysis
          const session = await this.createAnalysisSession(userId, 'profile_update', `${analysisType}_profile_update`);
          
          // Create analysis trigger record
          await this.createAnalysisTrigger(userId, 'profile_update', triggerSource, profileData, session.id);
          
          // Perform consolidated analysis based on type
          let analysisResults = [];
          
          switch (analysisType) {
            case 'skin':
              analysisResults = await this.analyzeSkinProfileConsolidated(userId, profileData, userContext, session.id);
              break;
            case 'hair':
              analysisResults = await this.analyzeHairProfileConsolidated(userId, profileData, userContext, session.id);
              break;
            case 'lifestyle':
              analysisResults = await this.analyzeLifestyleProfileConsolidated(userId, profileData, userContext, session.id);
              break;
            case 'health':
              analysisResults = await this.analyzeHealthProfileConsolidated(userId, profileData, userContext, session.id);
              break;
            case 'makeup':
              analysisResults = await this.analyzeMakeupProfileConsolidated(userId, profileData, userContext, session.id);
              break;
            case 'comprehensive':
              analysisResults = await this.performComprehensiveAnalysisConsolidated(userId, userContext, session.id);
              break;
            default:
              throw new Error(`Unknown analysis type: ${analysisType}`);
          }
          
          // Complete the session
          await this.completeAnalysisSession(session.id, analysisResults);
          
          return {
            sessionId: session.id,
            analysisResults,
            summary: await this.generateSessionSummary(analysisResults)
          };
        }
      );
      
      // If from cache, we still want to provide a session-like response
      if (analysisResult.fromCache) {
        Logger.info(`AI analysis retrieved from cache for user ${userId}`, { analysisType });
        return {
          ...analysisResult.data,
          fromCache: true,
          cacheInfo: analysisResult.cacheInfo
        };
      }
      
      Logger.info(`AI analysis completed for user ${userId}`, { generated: 'new_analysis' });
      return {
        ...analysisResult.data,
        fromCache: false,
        cacheInfo: analysisResult.cacheInfo
      };
      
    } catch (error) {
      Logger.error('AI Analysis Service Error', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze skin profile data - SINGLE API CALL with comprehensive analysis
   */
  async analyzeSkinProfile(userId, skinData, userContext, sessionId) {
    const analyses = [];
    
    // Single comprehensive skin analysis instead of multiple calls
    Logger.debug('Performing single comprehensive skin analysis');
    
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
    
    Logger.debug('Comprehensive skin analysis completed');
    return analyses;
  }

  /**
   * CONSOLIDATED Skin Profile Analysis - Single comprehensive AI call
   */
  async analyzeSkinProfileConsolidated(userId, skinData, userContext, sessionId) {
    Logger.debug('Performing consolidated skin profile analysis');
    
    // Single comprehensive analysis combining all aspects
    const analysis = await this.performAIAnalysis({
      type: 'consolidated_skin_analysis',
      data: skinData,
      context: userContext,
      prompt: this.buildComprehensiveProfilePrompt('skin', skinData, userContext)
    });
    
    // Parse all insights at once from the consolidated response
    const parsedAnalysis = this.parseConsolidatedSkinAnalysis(analysis);
    
    // Save consolidated result
    const analysisResult = await this.saveAnalysisResult(
      userId, 'skin', 'consolidated_analysis', skinData, parsedAnalysis, sessionId
    );
    
    Logger.debug('Consolidated skin analysis completed');
    return [analysisResult];
  }

  /**
   * Analyze hair profile data - SINGLE API CALL
   */
  async analyzeHairProfile(userId, hairData, userContext, sessionId) {
    const analyses = [];
    
    Logger.debug('Performing comprehensive hair analysis');
    
    const comprehensiveAnalysis = await this.performAIAnalysis({
      type: 'comprehensive_hair_analysis',
      data: hairData,
      context: userContext,
      prompt: this.generateComprehensiveHairPrompt(hairData, userContext)
    });
    
    analyses.push(await this.saveAnalysisResult(
      userId, 'hair', 'comprehensive_analysis', hairData, comprehensiveAnalysis, sessionId
    ));
    
    Logger.debug('Comprehensive hair analysis completed');
    return analyses;
  }

  /**
   * CONSOLIDATED Hair Profile Analysis - Single comprehensive AI call
   */
  async analyzeHairProfileConsolidated(userId, hairData, userContext, sessionId) {
    Logger.debug('Performing consolidated hair profile analysis');
    
    const analysis = await this.performAIAnalysis({
      type: 'consolidated_hair_analysis',
      data: hairData,
      context: userContext,
      prompt: this.buildComprehensiveProfilePrompt('hair', hairData, userContext)
    });
    
    const parsedAnalysis = this.parseConsolidatedHairAnalysis(analysis);
    
    const analysisResult = await this.saveAnalysisResult(
      userId, 'hair', 'consolidated_analysis', hairData, parsedAnalysis, sessionId
    );
    
    Logger.debug('Consolidated hair analysis completed');
    return [analysisResult];
  }

  /**
   * Analyze lifestyle profile data - SINGLE API CALL
   */
  async analyzeLifestyleProfile(userId, lifestyleData, userContext, sessionId) {
    const analyses = [];
    
    Logger.debug('Performing comprehensive lifestyle analysis');
    
    const comprehensiveAnalysis = await this.performAIAnalysis({
      type: 'comprehensive_lifestyle_analysis',
      data: lifestyleData,
      context: userContext,
      prompt: this.generateComprehensiveLifestylePrompt(lifestyleData, userContext)
    });
    
    analyses.push(await this.saveAnalysisResult(
      userId, 'lifestyle', 'comprehensive_analysis', lifestyleData, comprehensiveAnalysis, sessionId
    ));
    
    Logger.debug('Comprehensive lifestyle analysis completed');
    return analyses;
  }

  /**
   * CONSOLIDATED Lifestyle Profile Analysis - Single comprehensive AI call
   */
  async analyzeLifestyleProfileConsolidated(userId, lifestyleData, userContext, sessionId) {
    Logger.debug('Performing consolidated lifestyle profile analysis');
    
    const analysis = await this.performAIAnalysis({
      type: 'consolidated_lifestyle_analysis',
      data: lifestyleData,
      context: userContext,
      prompt: this.buildComprehensiveProfilePrompt('lifestyle', lifestyleData, userContext)
    });
    
    const parsedAnalysis = this.parseConsolidatedLifestyleAnalysis(analysis);
    
    const analysisResult = await this.saveAnalysisResult(
      userId, 'lifestyle', 'consolidated_analysis', lifestyleData, parsedAnalysis, sessionId
    );
    
    Logger.debug('Consolidated lifestyle analysis completed');
    return [analysisResult];
  }

  /**
   * Analyze health profile data - SINGLE API CALL
   */
  async analyzeHealthProfile(userId, healthData, userContext, sessionId) {
    const analyses = [];
    
    Logger.debug('Performing comprehensive health analysis');
    
    const comprehensiveAnalysis = await this.performAIAnalysis({
      type: 'comprehensive_health_analysis',
      data: healthData,
      context: userContext,
      prompt: this.generateComprehensiveHealthPrompt(healthData, userContext)
    });
    
    analyses.push(await this.saveAnalysisResult(
      userId, 'health', 'comprehensive_analysis', healthData, comprehensiveAnalysis, sessionId
    ));
    
    Logger.debug('Comprehensive health analysis completed');
    return analyses;
  }

  /**
   * CONSOLIDATED Health Profile Analysis - Single comprehensive AI call
   */
  async analyzeHealthProfileConsolidated(userId, healthData, userContext, sessionId) {
    Logger.debug('Performing consolidated health profile analysis');
    
    const analysis = await this.performAIAnalysis({
      type: 'consolidated_health_analysis',
      data: healthData,
      context: userContext,
      prompt: this.buildComprehensiveProfilePrompt('health', healthData, userContext)
    });
    
    const parsedAnalysis = this.parseConsolidatedHealthAnalysis(analysis);
    
    const analysisResult = await this.saveAnalysisResult(
      userId, 'health', 'consolidated_analysis', healthData, parsedAnalysis, sessionId
    );
    
    Logger.debug('Consolidated health analysis completed');
    return [analysisResult];
  }

  /**
   * Analyze makeup profile data - SINGLE API CALL
   */
  async analyzeMakeupProfile(userId, makeupData, userContext, sessionId) {
    const analyses = [];
    
    Logger.debug('Performing comprehensive makeup analysis');
    
    const comprehensiveAnalysis = await this.performAIAnalysis({
      type: 'comprehensive_makeup_analysis',
      data: makeupData,
      context: userContext,
      prompt: this.generateComprehensiveMakeupPrompt(makeupData, userContext)
    });
    
    analyses.push(await this.saveAnalysisResult(
      userId, 'makeup', 'comprehensive_analysis', makeupData, comprehensiveAnalysis, sessionId
    ));
    
    Logger.debug('Comprehensive makeup analysis completed');
    return analyses;
  }

  /**
   * CONSOLIDATED Makeup Profile Analysis - Single comprehensive AI call
   */
  async analyzeMakeupProfileConsolidated(userId, makeupData, userContext, sessionId) {
    Logger.debug('Performing consolidated makeup profile analysis');
    
    const analysis = await this.performAIAnalysis({
      type: 'consolidated_makeup_analysis',
      data: makeupData,
      context: userContext,
      prompt: this.buildComprehensiveProfilePrompt('makeup', makeupData, userContext)
    });
    
    const parsedAnalysis = this.parseConsolidatedMakeupAnalysis(analysis);
    
    const analysisResult = await this.saveAnalysisResult(
      userId, 'makeup', 'consolidated_analysis', makeupData, parsedAnalysis, sessionId
    );
    
    Logger.debug('Consolidated makeup analysis completed');
    return [analysisResult];
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
   * CONSOLIDATED Comprehensive Analysis - Single comprehensive AI call across all profile data
   */
  async performComprehensiveAnalysisConsolidated(userId, userContext, sessionId) {
    Logger.debug('Performing consolidated comprehensive analysis');
    
    const analysis = await this.performAIAnalysis({
      type: 'consolidated_comprehensive_analysis',
      data: userContext,
      context: userContext,
      prompt: this.buildComprehensiveProfilePrompt('comprehensive', userContext, userContext)
    });
    
    const parsedAnalysis = this.parseConsolidatedComprehensiveAnalysis(analysis);
    
    const analysisResult = await this.saveAnalysisResult(
      userId, 'comprehensive', 'consolidated_analysis', userContext, parsedAnalysis, sessionId
    );
    
    Logger.debug('Consolidated comprehensive analysis completed');
    return [analysisResult];
  }

  /**
   * Core AI analysis function using Gemini with rate limiting and retries
   */
  async performAIAnalysis({ type, data, context, prompt }) {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        Logger.debug(`AI Analysis attempt ${attempt}/${maxRetries} for ${type}`);
        
        // Add delay between API calls to respect rate limits
        if (attempt > 1) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          Logger.debug(`Waiting ${delay}ms before retry`);
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
          Logger.warn(`Failed to parse AI response as JSON`, { error: parseError.message });
          structuredResult = {
            analysis: analysisText,
            confidence: 0.8,
            recommendations: [],
            insights: [],
            parsing_error: parseError.message
          };
        }
        
        Logger.debug(`AI Analysis successful for ${type} on attempt ${attempt}`);
        return {
          ...structuredResult,
          model: 'gemini-2.0-flash',
          analysis_type: type,
          timestamp: new Date().toISOString()
        };
        
      } catch (error) {
        Logger.error(`AI Analysis Error for ${type} (attempt ${attempt})`, { error: error.message });
        
        // If it's a rate limit error and we have retries left, continue
        if (error.status === 429 && attempt < maxRetries) {
          const retryDelay = error.errorDetails?.[2]?.retryDelay || '5s';
          const delayMs = retryDelay.includes('s') ? parseInt(retryDelay) * 1000 : 5000;
          Logger.warn(`Rate limited. Waiting ${delayMs}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        
        // If we've exhausted retries or it's not a rate limit error, return fallback
        Logger.warn(`AI Analysis failed for ${type} after ${attempt} attempts. Using fallback.`);
        return this.generateFallbackAnalysis(type, data, context);
      }
    }
  }

  /**
   * Generate fallback analysis when AI service is unavailable
   */
  generateFallbackAnalysis(type, data, context) {
    Logger.info(`Generating fallback analysis for ${type}`);
    
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
   * NEW CONSOLIDATED METHODS FOR SINGLE AI CALLS
   */

  /**
   * Build comprehensive profile prompt for consolidated analysis
   */
  buildComprehensiveProfilePrompt(profileType, profileData, userContext) {
    const baseContext = `
User Context:
- Age: ${userContext.age || 'Not specified'}
- Gender: ${userContext.gender || 'Not specified'}
- Location: ${userContext.location || 'Not specified'}
- Climate: ${userContext.climate || 'Not specified'}
- Skin Type: ${userContext.skin_type || 'Not specified'}
- Skin Tone: ${userContext.skin_tone || 'Not specified'}
- Hair Type: ${userContext.hair_type || 'Not specified'}

Profile Data:
${JSON.stringify(profileData, null, 2)}

IMPORTANT: Respond with ONLY valid JSON. Do not include any markdown formatting, code blocks, or explanatory text. Return just the raw JSON object.
`;

    switch (profileType) {
      case 'skin':
        return `${baseContext}
Provide a comprehensive skin analysis including ALL aspects in a single response:

{
  "skin_type_assessment": {
    "confirmed_type": "oily|dry|combination|sensitive|normal",
    "confidence": 0.85,
    "reasoning": "Detailed explanation based on profile data"
  },
  "concerns_analysis": [
    {
      "concern": "acne|aging|dryness|sensitivity|pigmentation",
      "severity": "mild|moderate|severe",
      "treatment_priority": 1,
      "recommended_ingredients": ["ingredient1", "ingredient2"],
      "timeline": "Expected improvement timeline"
    }
  ],
  "ingredient_recommendations": {
    "recommended": ["niacinamide", "hyaluronic acid", "retinol"],
    "avoid": ["harsh sulfates", "fragrances"],
    "reasoning": "Why these ingredients work for this profile"
  },
  "product_recommendations": [
    {
      "category": "cleanser|moisturizer|serum|sunscreen",
      "product_type": "specific product type",
      "key_ingredients": ["ingredient1", "ingredient2"],
      "usage": "application instructions",
      "priority": 1
    }
  ],
  "routine_recommendations": {
    "morning": ["step1", "step2", "step3"],
    "evening": ["step1", "step2", "step3"],
    "weekly": ["exfoliation", "masks"]
  },
  "confidence_score": 0.85,
  "key_insights": ["insight1", "insight2", "insight3"],
  "recommendations": [
    {
      "title": "recommendation title",
      "description": "detailed description",
      "priority": 1
    }
  ]
}`;

      case 'hair':
        return `${baseContext}
Provide comprehensive hair analysis including ALL aspects:

{
  "hair_type_assessment": {
    "confirmed_type": "straight|wavy|curly|coily",
    "texture": "fine|medium|coarse",
    "porosity": "low|medium|high",
    "density": "thin|medium|thick",
    "confidence": 0.85
  },
  "concerns_analysis": [
    {
      "concern": "dryness|damage|thinning|oily_scalp|dandruff",
      "severity": "mild|moderate|severe",
      "treatment_priority": 1,
      "recommended_ingredients": ["ingredient1", "ingredient2"],
      "timeline": "Expected improvement timeline"
    }
  ],
  "care_recommendations": {
    "washing_frequency": "frequency based on hair type",
    "recommended_products": ["shampoo type", "conditioner type", "treatments"],
    "styling_tips": ["tip1", "tip2", "tip3"]
  },
  "ingredient_recommendations": {
    "beneficial": ["keratin", "argan oil", "biotin"],
    "avoid": ["sulfates", "alcohols"],
    "reasoning": "Why these work for this hair type"
  },
  "confidence_score": 0.85,
  "key_insights": ["insight1", "insight2"],
  "recommendations": [
    {
      "title": "Hair Care Routine",
      "description": "Customized routine for hair type",
      "priority": 1
    }
  ]
}`;

      case 'lifestyle':
        return `${baseContext}
Analyze lifestyle and environmental factors affecting beauty and wellness:

{
  "environmental_analysis": {
    "climate_impact": "How climate affects skin/hair",
    "pollution_effects": "Environmental stressor analysis",
    "protective_measures": ["sunscreen", "antioxidants", "barriers"]
  },
  "lifestyle_factors": {
    "diet_impact": "How diet affects skin/hair health",
    "sleep_quality": "Impact of sleep on beauty",
    "stress_levels": "Stress effects on appearance",
    "exercise_routine": "Benefits of physical activity"
  },
  "recommendations": {
    "diet": ["omega-3", "antioxidants", "hydration"],
    "sleep": "7-9 hours for skin regeneration",
    "stress_management": ["meditation", "skincare as self-care"],
    "environmental_protection": ["daily SPF", "pollution barriers"]
  },
  "confidence_score": 0.8,
  "key_insights": ["lifestyle factors identified", "protection strategies provided"],
  "recommendations": [
    {
      "title": "Holistic Wellness",
      "description": "Integrate beauty with lifestyle",
      "priority": 1
    }
  ]
}`;

      case 'health':
        return `${baseContext}
Analyze health factors and provide safe beauty recommendations:

{
  "health_impact_analysis": {
    "skin_effects": "How health conditions affect skin",
    "hair_effects": "How conditions affect hair health",
    "medication_interactions": "Potential interactions with beauty products"
  },
  "safe_recommendations": {
    "gentle_ingredients": ["hypoallergenic", "fragrance-free", "dermatologist-tested"],
    "ingredients_to_avoid": ["harsh actives", "potential irritants"],
    "patch_testing": "Always recommend patch testing"
  },
  "professional_guidance": {
    "dermatologist_consultation": "When to seek professional help",
    "medication_considerations": "Discuss with healthcare provider"
  },
  "confidence_score": 0.75,
  "key_insights": ["health factors assessed", "safety prioritized"],
  "recommendations": [
    {
      "title": "Gentle Approach",
      "description": "Prioritize gentle, safe products",
      "priority": 1
    }
  ]
}`;

      case 'makeup':
        return `${baseContext}
Provide comprehensive makeup recommendations:

{
  "color_analysis": {
    "skin_tone_match": "Foundation matching guidance",
    "undertone_compatibility": "Colors that complement undertone",
    "seasonal_palette": "Colors for different seasons"
  },
  "product_recommendations": [
    {
      "category": "foundation|concealer|blush|lipstick|eyeshadow",
      "shade_guidance": "specific shade recommendations",
      "formula_type": "liquid|powder|cream",
      "application_tips": ["tip1", "tip2"]
    }
  ],
  "look_suggestions": {
    "everyday": "Natural, workplace-appropriate",
    "evening": "More dramatic, occasion-wear",
    "special_events": "Full glam recommendations"
  },
  "confidence_score": 0.8,
  "key_insights": ["color palette customized", "looks tailored to lifestyle"],
  "recommendations": [
    {
      "title": "Personalized Color Palette",
      "description": "Makeup colors that enhance natural beauty",
      "priority": 1
    }
  ]
}`;

      case 'comprehensive':
        return `${baseContext}
Provide holistic beauty and wellness analysis across all aspects:

{
  "overall_assessment": {
    "beauty_profile_summary": "Complete overview of user's beauty profile",
    "primary_focus_areas": ["area1", "area2", "area3"],
    "interconnected_factors": "How different aspects relate to each other"
  },
  "integrated_recommendations": {
    "skincare_haircare_synergy": "How routines can complement each other",
    "lifestyle_beauty_integration": "Incorporating beauty into daily life",
    "health_conscious_approach": "Balancing beauty goals with health"
  },
  "priority_action_plan": [
    {
      "phase": 1,
      "timeline": "first 4 weeks",
      "focus": "essential routine establishment",
      "actions": ["action1", "action2", "action3"]
    },
    {
      "phase": 2,
      "timeline": "weeks 5-12",
      "focus": "advanced treatments and optimization",
      "actions": ["action1", "action2"]
    }
  ],
  "long_term_strategy": {
    "maintenance_routine": "Sustainable long-term approach",
    "periodic_reassessment": "When to review and adjust",
    "professional_support": "When to seek expert guidance"
  },
  "confidence_score": 0.85,
  "key_insights": ["holistic approach recommended", "personalized strategy developed"],
  "recommendations": [
    {
      "title": "Integrated Beauty Wellness",
      "description": "Comprehensive approach to beauty and health",
      "priority": 1
    }
  ]
}`;

      default:
        throw new Error(`Unknown profile type: ${profileType}`);
    }
  }

  /**
   * PARSING METHODS FOR CONSOLIDATED ANALYSIS
   */

  parseConsolidatedSkinAnalysis(analysis) {
    return {
      skincare: this.extractSkincareInsights(analysis),
      ingredients: this.extractIngredientRecommendations(analysis),
      products: this.extractProductRecommendations(analysis),
      routine: this.extractRoutineRecommendations(analysis),
      rawAnalysis: analysis
    };
  }

  parseConsolidatedHairAnalysis(analysis) {
    return {
      haircare: this.extractHaircareInsights(analysis),
      products: this.extractHairProductRecommendations(analysis),
      routine: this.extractHairRoutineRecommendations(analysis),
      styling: this.extractStylingRecommendations(analysis),
      rawAnalysis: analysis
    };
  }

  parseConsolidatedLifestyleAnalysis(analysis) {
    return {
      environmental: this.extractEnvironmentalFactors(analysis),
      lifestyle: this.extractLifestyleRecommendations(analysis),
      protection: this.extractProtectiveMeasures(analysis),
      wellness: this.extractWellnessInsights(analysis),
      rawAnalysis: analysis
    };
  }

  parseConsolidatedHealthAnalysis(analysis) {
    return {
      healthImpact: this.extractHealthImpactAnalysis(analysis),
      safeIngredients: this.extractSafeIngredients(analysis),
      precautions: this.extractHealthPrecautions(analysis),
      professionalGuidance: this.extractProfessionalRecommendations(analysis),
      rawAnalysis: analysis
    };
  }

  parseConsolidatedMakeupAnalysis(analysis) {
    return {
      colorMatching: this.extractColorRecommendations(analysis),
      products: this.extractMakeupProductRecommendations(analysis),
      looks: this.extractLookSuggestions(analysis),
      techniques: this.extractApplicationTechniques(analysis),
      rawAnalysis: analysis
    };
  }

  parseConsolidatedComprehensiveAnalysis(analysis) {
    return {
      overallAssessment: this.extractOverallAssessment(analysis),
      integratedRecommendations: this.extractIntegratedRecommendations(analysis),
      actionPlan: this.extractActionPlan(analysis),
      longTermStrategy: this.extractLongTermStrategy(analysis),
      rawAnalysis: analysis
    };
  }

  /**
   * EXTRACTION HELPER METHODS
   */

  extractSkincareInsights(analysis) {
    return {
      skinType: analysis.skin_type_assessment || {},
      concerns: analysis.concerns_analysis || [],
      confidence: analysis.confidence_score || 0.8
    };
  }

  extractIngredientRecommendations(analysis) {
    return {
      recommended: analysis.ingredient_recommendations?.recommended || [],
      avoid: analysis.ingredient_recommendations?.avoid || [],
      reasoning: analysis.ingredient_recommendations?.reasoning || ''
    };
  }

  extractProductRecommendations(analysis) {
    return analysis.product_recommendations || [];
  }

  extractRoutineRecommendations(analysis) {
    return analysis.routine_recommendations || {};
  }

  extractHaircareInsights(analysis) {
    return {
      hairType: analysis.hair_type_assessment || {},
      concerns: analysis.concerns_analysis || []
    };
  }

  extractHairProductRecommendations(analysis) {
    return analysis.care_recommendations?.recommended_products || [];
  }

  extractHairRoutineRecommendations(analysis) {
    return {
      washingFrequency: analysis.care_recommendations?.washing_frequency || '',
      routine: analysis.care_recommendations || {}
    };
  }

  extractStylingRecommendations(analysis) {
    return analysis.care_recommendations?.styling_tips || [];
  }

  extractEnvironmentalFactors(analysis) {
    return analysis.environmental_analysis || {};
  }

  extractLifestyleRecommendations(analysis) {
    return analysis.lifestyle_factors || {};
  }

  extractProtectiveMeasures(analysis) {
    return analysis.environmental_analysis?.protective_measures || [];
  }

  extractWellnessInsights(analysis) {
    return analysis.recommendations || {};
  }

  extractHealthImpactAnalysis(analysis) {
    return analysis.health_impact_analysis || {};
  }

  extractSafeIngredients(analysis) {
    return analysis.safe_recommendations || {};
  }

  extractHealthPrecautions(analysis) {
    return analysis.safe_recommendations?.ingredients_to_avoid || [];
  }

  extractProfessionalRecommendations(analysis) {
    return analysis.professional_guidance || {};
  }

  extractColorRecommendations(analysis) {
    return analysis.color_analysis || {};
  }

  extractMakeupProductRecommendations(analysis) {
    return analysis.product_recommendations || [];
  }

  extractLookSuggestions(analysis) {
    return analysis.look_suggestions || {};
  }

  extractApplicationTechniques(analysis) {
    return analysis.product_recommendations?.map(p => p.application_tips).flat() || [];
  }

  extractOverallAssessment(analysis) {
    return analysis.overall_assessment || {};
  }

  extractIntegratedRecommendations(analysis) {
    return analysis.integrated_recommendations || {};
  }

  extractActionPlan(analysis) {
    return analysis.priority_action_plan || [];
  }

  extractLongTermStrategy(analysis) {
    return analysis.long_term_strategy || {};
  }

  /**
   * Cache management methods
   */
  async invalidateUserAnalysisCache(userId, analysisType = null) {
    Logger.info(`Invalidating analysis cache for user ${userId}`, { analysisType });
    await this.cacheService.invalidateCache(userId, analysisType);
  }

  async getCacheStatistics(userId = null) {
    return await this.cacheService.getCacheStats(userId);
  }

  async cleanupExpiredCache() {
    Logger.info('Cleaning up expired analysis cache entries');
    await this.cacheService.cleanupExpiredCache();
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