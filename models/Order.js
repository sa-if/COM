const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // required: true // Uncomment if guest checkout is NOT allowed
  },
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    // Basic email format validation (can be more robust)
    match: [/.+\@.+\..+/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
    // Add validation regex if needed, e.g., for specific country formats
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to Product _id
        ref: 'Product', // Optional: link to Product model
        required: true
      },
      name: { type: String, required: true }, // Store name at time of order
      price: { type: Number, required: true }, // Store price at time of order
      quantity: { type: Number, required: true }
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['COD', 'Bkash']
  },
  paymentNumber: {
    type: String,
    trim: true
  },
  transactionId: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Processing'
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  customerIP: { // Store IP from where the order was placed
    type: String
  }
});

module.exports = mongoose.model('Order', OrderSchema); 