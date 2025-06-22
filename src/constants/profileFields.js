/**
 * Beauty Profile Form Fields Configuration
 * This file defines all required and optional fields for the beauty profile form
 * along with their validation rules and available options.
 */

const PROFILE_FIELDS = {
  // SECTION 1: SKIN PROFILE (Required)
  skin: {
    skin_type: {
      label: 'Skin Type',
      type: 'select',
      required: true,
      options: ['dry', 'oily', 'combination', 'normal', 'sensitive'],
      description: 'Your primary skin type'
    },
    skin_tone: {
      label: 'Skin Tone',
      type: 'select',
      required: true,
      options: ['fair', 'light', 'medium', 'tan', 'deep'],
      description: 'Your skin tone/complexion'
    },
    undertone: {
      label: 'Undertone',
      type: 'select',
      required: true,
      options: ['warm', 'cool', 'neutral'],
      description: 'Your skin undertone'
    },
    primary_concerns: {
      label: 'Primary Skin Concerns',
      type: 'multiselect',
      required: true,
      minItems: 1,
      maxItems: 5,
      options: [
        'acne',
        'dark_spots',
        'wrinkles',
        'fine_lines',
        'hyperpigmentation',
        'redness',
        'large_pores',
        'blackheads',
        'whiteheads',
        'dullness',
        'uneven_texture',
        'dark_circles',
        'puffiness',
        'sensitivity',
        'dryness',
        'oiliness',
        'sun_damage',
        'melasma'
      ],
      description: 'Select your main skin concerns (1-5)'
    },
    sensitivity_level: {
      label: 'Skin Sensitivity Level',
      type: 'select',
      required: true,
      options: ['low', 'medium', 'high'],
      description: 'How sensitive is your skin?'
    },
    allergies: {
      label: 'Known Allergies/Ingredients to Avoid',
      type: 'multiselect',
      required: false,
      options: [
        'fragrance',
        'alcohol',
        'sulfates',
        'parabens',
        'mineral_oil',
        'retinol',
        'salicylic_acid',
        'glycolic_acid',
        'vitamin_c',
        'niacinamide',
        'essential_oils',
        'lanolin',
        'formaldehyde',
        'phthalates'
      ],
      customAllowed: true,
      description: 'Select or add ingredients you\'re allergic to'
    }
  },

  // SECTION 2: HAIR PROFILE (Optional but recommended)
  hair: {
    hair_type: {
      label: 'Hair Type',
      type: 'select',
      required: false,
      options: ['straight', 'wavy', 'curly', 'coily'],
      description: 'Your hair pattern type'
    },
    hair_texture: {
      label: 'Hair Texture',
      type: 'select',
      required: false,
      options: ['fine', 'medium', 'thick'],
      description: 'The thickness of individual hair strands'
    },
    scalp_condition: {
      label: 'Scalp Condition',
      type: 'select',
      required: false,
      options: ['dry', 'oily', 'normal', 'sensitive'],
      description: 'Your scalp condition'
    },
    primary_concerns: {
      label: 'Hair Concerns',
      type: 'multiselect',
      required: false,
      maxItems: 5,
      options: [
        'hair_fall',
        'dandruff',
        'frizz',
        'dryness',
        'oiliness',
        'damage',
        'split_ends',
        'thinning',
        'slow_growth',
        'color_fading',
        'lack_of_volume',
        'tangles'
      ],
      description: 'Select your main hair concerns'
    },
    chemical_treatments: {
      label: 'Chemical Treatments',
      type: 'multiselect',
      required: false,
      options: ['color', 'bleach', 'keratin', 'relaxer', 'perm', 'none'],
      description: 'Any chemical treatments on your hair'
    },
    styling_frequency: {
      label: 'Heat Styling Frequency',
      type: 'select',
      required: false,
      options: ['daily', 'weekly', '2-3_times_week', 'rarely', 'never'],
      description: 'How often do you use heat styling tools?'
    }
  },

  // SECTION 3: LIFESTYLE (Required)
  lifestyle: {
    location: {
      label: 'Location',
      type: 'text',
      required: true,
      placeholder: 'City, Country',
      description: 'Your current location (e.g., Mumbai, India)'
    },
    climate_type: {
      label: 'Climate Type',
      type: 'select',
      required: true,
      options: ['tropical', 'dry', 'temperate', 'continental', 'polar'],
      description: 'Your local climate'
    },
    pollution_level: {
      label: 'Pollution Level',
      type: 'select',
      required: true,
      options: ['low', 'moderate', 'high', 'severe'],
      description: 'Air pollution level in your area'
    },
    sun_exposure: {
      label: 'Daily Sun Exposure',
      type: 'select',
      required: true,
      options: ['minimal', 'low', 'moderate', 'high'],
      description: 'Average daily sun exposure'
    },
    sleep_hours: {
      label: 'Average Sleep Hours',
      type: 'number',
      required: true,
      min: 3,
      max: 12,
      description: 'Hours of sleep per night'
    },
    stress_level: {
      label: 'Stress Level',
      type: 'select',
      required: true,
      options: ['low', 'moderate', 'high', 'severe'],
      description: 'Your general stress level'
    },
    exercise_frequency: {
      label: 'Exercise Frequency',
      type: 'select',
      required: true,
      options: ['daily', '3_times_week', 'weekly', 'rarely', 'never'],
      description: 'How often do you exercise?'
    },
    water_intake: {
      label: 'Daily Water Intake',
      type: 'select',
      required: false,
      options: ['less_than_4', '4-6_glasses', '6-8_glasses', 'more_than_8'],
      description: 'Glasses of water per day'
    }
  },

  // SECTION 4: HEALTH (Optional but recommended)
  health: {
    age: {
      label: 'Age',
      type: 'number',
      required: false,
      min: 13,
      max: 100,
      description: 'Your age'
    },
    hormonal_status: {
      label: 'Hormonal Status',
      type: 'select',
      required: false,
      options: [
        'normal',
        'pregnancy',
        'breastfeeding',
        'menopause',
        'pcos',
        'thyroid'
      ],
      description: 'Any hormonal conditions'
    },
    medications: {
      label: 'Current Medications',
      type: 'text',
      required: false,
      isArray: true,
      description: 'List any medications affecting skin/hair'
    },
    skin_conditions: {
      label: 'Skin Medical Conditions',
      type: 'multiselect',
      required: false,
      options: [
        'eczema',
        'psoriasis',
        'rosacea',
        'dermatitis',
        'vitiligo',
        'none'
      ],
      description: 'Any diagnosed skin conditions'
    },
    dietary_restrictions: {
      label: 'Dietary Type',
      type: 'multiselect',
      required: false,
      options: [
        'omnivore',
        'vegetarian',
        'vegan',
        'pescatarian'
      ],
      description: 'Your dietary preferences/restrictions'
    }
  },

  // SECTION 5: MAKEUP PREFERENCES (Optional)
  makeup: {
    makeup_frequency: {
      label: 'Makeup Usage Frequency',
      type: 'select',
      required: false,
      options: ['never', 'special_occasions', 'weekly', 'daily', 'multiple_daily'],
      description: 'How often do you wear makeup?'
    },
    preferred_look: {
      label: 'Preferred Makeup Look',
      type: 'select',
      required: false,
      options: ['natural', 'professional', 'glam', 'dramatic', 'artistic'],
      description: 'Your go-to makeup style'
    },
    coverage_preference: {
      label: 'Coverage Preference',
      type: 'select',
      required: false,
      options: ['none', 'light', 'medium', 'full'],
      description: 'Preferred foundation coverage'
    }
  },

  // SECTION 6: PREFERENCES & BUDGET
  preferences: {
    budget_range: {
      label: 'Monthly Beauty Budget',
      type: 'select',
      required: true,
      options: [
        'budget',
        'mid_range',
        'luxury',
        'mixed'
      ],
      currency: 'INR',
      description: 'Monthly budget for beauty products'
    },
    brand_preference: {
      label: 'Brand Preference',
      type: 'select',
      required: false,
      options: ['luxury', 'premium', 'drugstore', 'indie', 'no_preference'],
      description: 'Preferred brand category'
    },
    ingredient_preference: {
      label: 'Ingredient Preference',
      type: 'multiselect',
      required: false,
      options: [
        'natural',
        'organic',
        'vegan',
        'cruelty_free',
        'clean_beauty',
        'k_beauty',
        'ayurvedic',
        'clinical',
        'no_preference'
      ],
      description: 'Product ingredient preferences'
    }
  }
};

// Validation helpers
const VALIDATION_RULES = {
  skin_type: (value) => PROFILE_FIELDS.skin.skin_type.options.includes(value),
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  age: (value) => value >= 13 && value <= 100,
  multiselect_min: (value, min) => Array.isArray(value) && value.length >= min,
  multiselect_max: (value, max) => Array.isArray(value) && value.length <= max
};

// Helper to get required fields only
const getRequiredFields = () => {
  const required = {};
  
  Object.entries(PROFILE_FIELDS).forEach(([section, fields]) => {
    required[section] = {};
    Object.entries(fields).forEach(([fieldName, config]) => {
      if (config.required) {
        required[section][fieldName] = config;
      }
    });
  });
  
  return required;
};

// Helper to check profile completion
const checkProfileCompletion = (userProfile) => {
  const requiredFields = getRequiredFields();
  const completion = {
    sections: {},
    overall: 0,
    missingFields: []
  };
  
  let totalRequired = 0;
  let totalCompleted = 0;
  
  Object.entries(requiredFields).forEach(([section, fields]) => {
    const sectionTotal = Object.keys(fields).length;
    let sectionCompleted = 0;
    
    Object.entries(fields).forEach(([fieldName, config]) => {
      totalRequired++;
      
      if (userProfile[fieldName]) {
        if (config.type === 'multiselect') {
          if (Array.isArray(userProfile[fieldName]) && userProfile[fieldName].length >= (config.minItems || 1)) {
            sectionCompleted++;
            totalCompleted++;
          } else {
            completion.missingFields.push(`${section}.${fieldName}`);
          }
        } else {
          sectionCompleted++;
          totalCompleted++;
        }
      } else {
        completion.missingFields.push(`${section}.${fieldName}`);
      }
    });
    
    completion.sections[section] = {
      total: sectionTotal,
      completed: sectionCompleted,
      percentage: sectionTotal > 0 ? Math.round((sectionCompleted / sectionTotal) * 100) : 100
    };
  });
  
  completion.overall = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0;
  completion.isComplete = completion.overall === 100;
  
  return completion;
};

module.exports = {
  PROFILE_FIELDS,
  VALIDATION_RULES,
  getRequiredFields,
  checkProfileCompletion
}; 