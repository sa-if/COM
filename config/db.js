const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Mongoose 6 deprecated these options, but keeping for broader compatibility awareness
      // Remove if using Mongoose 6+ and encountering warnings
      // useCreateIndex: true, // Deprecated
      // useFindAndModify: false // Deprecated
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB; 