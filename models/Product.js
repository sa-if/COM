const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  // Use a custom numeric ID if needed for frontend consistency, otherwise rely on MongoDB's _id
  // id: { 
  //   type: Number,
  //   required: true,
  //   unique: true
  // },
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please add a product description']
  },
  price: {
    type: Number,
    required: [true, 'Please add a product price']
  },
  image: {
    type: String, // URL to the image
    required: [true, 'Please add a product image URL']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// If you used a custom 'id', you might want to remove the default '_id'
// ProductSchema.set('toJSON', { 
//   transform: function (doc, ret, options) {
//       ret.id = ret._id; // Or use your custom id field
//       delete ret._id;
//       delete ret.__v;
//   }
// }); 

module.exports = mongoose.model('Product', ProductSchema); 