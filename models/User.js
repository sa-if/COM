const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define schema for items within the user's cart
const CartItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: { type: String, required: true }, // Store name at time of add
    price: { type: Number, required: true }, // Store price at time of add
    image: { type: String }, // Store image URL at time of add
    quantity: {
        type: Number,
        required: true,
        min: 1, // Ensure quantity is at least 1
        default: 1
    }
}, { _id: false }); // Don't create separate _id for subdocuments

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true, // Ensure emails are unique
    match: [
      /.+\@.+\..+/, // Basic email format validation
      'Please add a valid email'
    ],
    lowercase: true, // Store emails in lowercase
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't send password back by default in queries
  },
  // Add profile fields
  phone: {
      type: String,
      trim: true,
      default: '' // Default to empty string
  },
  address: {
      type: String,
      trim: true,
      default: '' // Default to empty string
  },
  profilePicUrl: {
      type: String,
      trim: true,
      default: '' // Default to empty string or a placeholder URL
  },
  // Add persistent cart field
  cart: {
      items: [CartItemSchema], // Array of cart items using the sub-schema
      // We can calculate totals dynamically when needed instead of storing them
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt before saving
UserSchema.pre('save', async function(next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) {
    return next();
  }

  // Hash the password with cost factor 10
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to match entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema); 