const Joi = require('joi');
const { body, validationResult } = require('express-validator');

const searchSchema = Joi.object({
  query: Joi.string().required().min(3).max(500).trim(),
  limit: Joi.number().integer().min(1).max(20).default(4),
  includeIngredients: Joi.boolean().default(true)
});

const productDetailsSchema = Joi.object({
  productId: Joi.string().required().trim()
});

const compareProductsSchema = Joi.object({
  productIds: Joi.array().items(Joi.string().trim()).min(2).max(10).required()
});

const productVideosSchema = Joi.object({
  productId: Joi.string().required().trim()
});

const videosSummarySchema = Joi.object({
  productIds: Joi.string().required().pattern(/^[^,]+(,[^,]+)*$/, 'comma-separated product IDs')
});

// Beauty profile validations
const validateBeautyProfile = {
  skin: Joi.object({
    skin_type: Joi.string().valid('dry', 'oily', 'combination', 'normal', 'sensitive'),
    skin_tone: Joi.string().valid('fair', 'light', 'medium', 'tan', 'deep'),
    undertone: Joi.string().valid('warm', 'cool', 'neutral'),
    fitzpatrick_phototype: Joi.number().integer().min(1).max(6),
    primary_concerns: Joi.array().items(Joi.string()).max(5),
    known_allergies: Joi.array().items(Joi.string()),
    sensitivity_level: Joi.string().valid('low', 'medium', 'high'),
    daily_sun_exposure: Joi.number().integer().min(0).max(1440),
    sunscreen_usage: Joi.string().valid('never', 'sometimes', 'daily', 'multiple_times'),
    photo_analysis_consent: Joi.boolean()
  }),
  
  hair: Joi.object({
    hair_pattern: Joi.string().valid('straight', 'wavy', 'curly', 'coily'),
    hair_texture: Joi.string().valid('fine', 'medium', 'coarse'),
    hair_thickness: Joi.string().valid('thin', 'medium', 'thick'),
    hair_density: Joi.string().valid('low', 'medium', 'high'),
    scalp_type: Joi.string().valid('dry', 'oily', 'normal', 'combination'),
    hair_porosity: Joi.string().valid('low', 'normal', 'high'),
    heat_styling_frequency: Joi.string().valid('never', 'rarely', 'weekly', 'daily'),
    wash_frequency: Joi.number().integer().min(1).max(14)
  }),
  
  lifestyle: Joi.object({
    location_city: Joi.string().trim().max(100),
    location_state: Joi.string().trim().max(100),
    climate_type: Joi.string().valid('tropical', 'dry', 'temperate', 'continental', 'polar'),
    pollution_level: Joi.string().valid('low', 'moderate', 'high', 'severe'),
    uv_exposure_level: Joi.string().valid('minimal', 'moderate', 'high', 'extreme'),
    diet_type: Joi.string().valid('vegetarian', 'vegan', 'non_vegetarian', 'pescatarian'),
    sleep_hours: Joi.number().min(0).max(24),
    stress_level: Joi.string().valid('low', 'moderate', 'high', 'severe'),
    exercise_frequency: Joi.string().valid('sedentary', 'light', 'moderate', 'active', 'very_active')
  }),
  
  health: Joi.object({
    skin_conditions: Joi.array().items(Joi.string()),
    hair_scalp_disorders: Joi.array().items(Joi.string()),
    systemic_allergies: Joi.array().items(Joi.string()),
    photosensitivity: Joi.boolean(),
    hormonal_status: Joi.string().valid('normal', 'pregnancy', 'breastfeeding', 'menopause', 'pcos', 'thyroid_disorder'),
    chronic_conditions: Joi.array().items(Joi.string())
  }),
  
  makeup: Joi.object({
    foundation_undertone: Joi.string().valid('warm', 'cool', 'neutral'),
    foundation_finish: Joi.string().valid('matte', 'dewy', 'satin', 'natural'),
    coverage_preference: Joi.string().valid('light', 'medium', 'full', 'buildable'),
    makeup_frequency: Joi.string().valid('never', 'special_occasions', 'weekends', 'daily', 'multiple_daily'),
    makeup_style: Joi.string().valid('natural', 'casual', 'professional', 'glam', 'dramatic'),
    price_range_preference: Joi.string().valid('budget', 'mid_range', 'luxury', 'mixed'),
    sensitive_eyes: Joi.boolean(),
    contact_lenses: Joi.boolean()
  })
};

const validateSearch = (req, res, next) => {
  const { error, value } = searchSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details[0].message
    });
  }
  
  req.validatedData = value;
  next();
};

const validateProductDetails = (req, res, next) => {
  const { error, value } = productDetailsSchema.validate(req.params);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details[0].message
    });
  }
  
  req.validatedData = value;
  next();
};

const validateCompareProducts = (req, res, next) => {
  const { error, value } = compareProductsSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details[0].message
    });
  }
  
  req.validatedData = value;
  next();
};

const validateProductVideos = (req, res, next) => {
  const { error, value } = productVideosSchema.validate(req.params);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details[0].message
    });
  }
  
  req.validatedData = value;
  next();
};

const validateVideosSummary = (req, res, next) => {
  const { error, value } = videosSummarySchema.validate(req.query);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details[0].message
    });
  }
  
  req.validatedData = value;
  next();
};

// Helper function to handle validation results
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User Registration Validation
const validateUserRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('first_name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('last_name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .isMobilePhone('en-IN')
    .withMessage('Please provide a valid Indian mobile number'),
  body('date_of_birth')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Please provide a valid date of birth'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('Gender must be one of: male, female, other, prefer_not_to_say'),
  handleValidationErrors
];

// User Login Validation
const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Skin Profile Validation
const validateSkinProfile = [
  body('skin_type')
    .optional()
    .isIn(['dry', 'oily', 'combination', 'normal'])
    .withMessage('Skin type must be one of: dry, oily, combination, normal'),
  body('skin_tone')
    .optional()
    .isIn(['fair', 'medium', 'dusky', 'deep'])
    .withMessage('Skin tone must be one of: fair, medium, dusky, deep'),
  body('undertone')
    .optional()
    .isIn(['warm', 'cool', 'neutral'])
    .withMessage('Undertone must be one of: warm, cool, neutral'),
  body('fitzpatrick_phototype')
    .optional()
    .isInt({ min: 1, max: 6 })
    .withMessage('Fitzpatrick phototype must be between 1 and 6'),
  body('primary_concerns')
    .optional()
    .isArray()
    .withMessage('Primary concerns must be an array'),
  body('known_allergies')
    .optional()
    .isArray()
    .withMessage('Known allergies must be an array'),
  body('skin_sensitivity')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Skin sensitivity must be one of: low, medium, high'),
  body('daily_sun_exposure')
    .optional()
    .isInt({ min: 0, max: 1440 })
    .withMessage('Daily sun exposure must be between 0 and 1440 minutes'),
  body('sunscreen_usage')
    .optional()
    .isIn(['never', 'sometimes', 'daily', 'multiple_times'])
    .withMessage('Sunscreen usage must be one of: never, sometimes, daily, multiple_times'),
  body('photo_analysis_consent')
    .optional()
    .isBoolean()
    .withMessage('Photo analysis consent must be a boolean'),
  handleValidationErrors
];

// Hair Profile Validation
const validateHairProfile = [
  body('hair_pattern')
    .optional()
    .isIn(['straight', 'wavy', 'curly', 'coily'])
    .withMessage('Hair pattern must be one of: straight, wavy, curly, coily'),
  body('hair_texture')
    .optional()
    .isIn(['fine', 'medium', 'coarse'])
    .withMessage('Hair texture must be one of: fine, medium, coarse'),
  body('hair_thickness')
    .optional()
    .isIn(['thin', 'medium', 'thick'])
    .withMessage('Hair thickness must be one of: thin, medium, thick'),
  body('hair_density')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Hair density must be one of: low, medium, high'),
  body('scalp_type')
    .optional()
    .isIn(['dry', 'oily', 'normal', 'combination'])
    .withMessage('Scalp type must be one of: dry, oily, normal, combination'),
  body('hair_porosity')
    .optional()
    .isIn(['low', 'normal', 'high'])
    .withMessage('Hair porosity must be one of: low, normal, high'),
  body('heat_styling_frequency')
    .optional()
    .isIn(['never', 'rarely', 'weekly', 'daily'])
    .withMessage('Heat styling frequency must be one of: never, rarely, weekly, daily'),
  body('wash_frequency')
    .optional()
    .isInt({ min: 1, max: 14 })
    .withMessage('Wash frequency must be between 1 and 14 times per week'),
  handleValidationErrors
];

// Lifestyle Demographics Validation
const validateLifestyleDemographics = [
  body('location_city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City name must be less than 100 characters'),
  body('location_state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State name must be less than 100 characters'),
  body('climate_type')
    .optional()
    .isIn(['tropical', 'dry', 'temperate', 'continental', 'polar'])
    .withMessage('Climate type must be one of: tropical, dry, temperate, continental, polar'),
  body('pollution_level')
    .optional()
    .isIn(['low', 'moderate', 'high', 'severe'])
    .withMessage('Pollution level must be one of: low, moderate, high, severe'),
  body('uv_exposure_level')
    .optional()
    .isIn(['minimal', 'moderate', 'high', 'extreme'])
    .withMessage('UV exposure level must be one of: minimal, moderate, high, extreme'),
  body('diet_type')
    .optional()
    .isIn(['vegetarian', 'vegan', 'non_vegetarian', 'pescatarian'])
    .withMessage('Diet type must be one of: vegetarian, vegan, non_vegetarian, pescatarian'),
  body('sleep_hours')
    .optional()
    .isFloat({ min: 0, max: 24 })
    .withMessage('Sleep hours must be between 0 and 24'),
  body('stress_level')
    .optional()
    .isIn(['low', 'moderate', 'high', 'severe'])
    .withMessage('Stress level must be one of: low, moderate, high, severe'),
  body('exercise_frequency')
    .optional()
    .isIn(['sedentary', 'light', 'moderate', 'active', 'very_active'])
    .withMessage('Exercise frequency must be one of: sedentary, light, moderate, active, very_active'),
  handleValidationErrors
];

// Health Medical Conditions Validation
const validateHealthMedicalConditions = [
  body('skin_conditions')
    .optional()
    .isArray()
    .withMessage('Skin conditions must be an array'),
  body('hair_scalp_disorders')
    .optional()
    .isArray()
    .withMessage('Hair scalp disorders must be an array'),
  body('systemic_allergies')
    .optional()
    .isArray()
    .withMessage('Systemic allergies must be an array'),
  body('photosensitivity')
    .optional()
    .isBoolean()
    .withMessage('Photosensitivity must be a boolean'),
  body('hormonal_status')
    .optional()
    .isIn(['normal', 'pregnancy', 'breastfeeding', 'menopause', 'pcos', 'thyroid_disorder'])
    .withMessage('Hormonal status must be one of: normal, pregnancy, breastfeeding, menopause, pcos, thyroid_disorder'),
  body('chronic_conditions')
    .optional()
    .isArray()
    .withMessage('Chronic conditions must be an array'),
  handleValidationErrors
];

// Makeup Preferences Validation
const validateMakeupPreferences = [
  body('foundation_undertone')
    .optional()
    .isIn(['warm', 'cool', 'neutral'])
    .withMessage('Foundation undertone must be one of: warm, cool, neutral'),
  body('foundation_finish')
    .optional()
    .isIn(['matte', 'dewy', 'satin', 'natural'])
    .withMessage('Foundation finish must be one of: matte, dewy, satin, natural'),
  body('coverage_preference')
    .optional()
    .isIn(['light', 'medium', 'full', 'buildable'])
    .withMessage('Coverage preference must be one of: light, medium, full, buildable'),
  body('makeup_frequency')
    .optional()
    .isIn(['never', 'special_occasions', 'weekends', 'daily', 'multiple_daily'])
    .withMessage('Makeup frequency must be one of: never, special_occasions, weekends, daily, multiple_daily'),
  body('makeup_style')
    .optional()
    .isIn(['natural', 'casual', 'professional', 'glam', 'dramatic'])
    .withMessage('Makeup style must be one of: natural, casual, professional, glam, dramatic'),
  body('price_range_preference')
    .optional()
    .isIn(['budget', 'mid_range', 'luxury', 'mixed'])
    .withMessage('Price range preference must be one of: budget, mid_range, luxury, mixed'),
  body('sensitive_eyes')
    .optional()
    .isBoolean()
    .withMessage('Sensitive eyes must be a boolean'),
  body('contact_lenses')
    .optional()
    .isBoolean()
    .withMessage('Contact lenses must be a boolean'),
  handleValidationErrors
];

module.exports = {
  validateSearch,
  validateProductDetails,
  validateCompareProducts,
  validateProductVideos,
  validateVideosSummary,
  validateBeautyProfile,
  validateUserRegistration,
  validateUserLogin,
  validateSkinProfile,
  validateHairProfile,
  validateLifestyleDemographics,
  validateHealthMedicalConditions,
  validateMakeupPreferences,
  handleValidationErrors
}; 