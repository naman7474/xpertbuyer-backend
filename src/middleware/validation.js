const Joi = require('joi');

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

module.exports = {
  validateSearch,
  validateProductDetails,
  validateCompareProducts
}; 