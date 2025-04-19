const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
// dotenv.config({ path: '../.env' }); // Remove incorrect path
dotenv.config(); // Load .env from the current directory (project root)

// Load models
const Product = require('../models/Product');

// Connect to DB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Read JSON data (or define inline)
const products = [
    {
        name: "Awesome T-Shirt",
        description: "A comfortable and stylish t-shirt.",
        price: 25.00,
        image: "https://media.istockphoto.com/id/1830111752/photo/black-t-shirt-short-sleeve-mockup.jpg?s=1024x1024&w=is&k=20&c=XsmPOD73lHWEsXDf-blvm5oHiPzuen-SJRsLw4hsHi8="
    },
    {
        name: "Cool Coffee Mug",
        description: "Enjoy your coffee in this cool mug.",
        price: 12.50,
        image: "https://plus.unsplash.com/premium_photo-1674406102318-c9d362ad510b?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
    },
    {
        name: "Fun Stickers Pack",
        description: "A pack of fun and colorful stickers.",
        price: 5.00,
        image: "https://img.freepik.com/free-vector/funny-sticker-hand-drawn-collection_23-2148373655.jpg"
    }
];

// Import data into DB
const importData = async () => {
    try {
        await Product.deleteMany(); // Clear existing products
        await Product.insertMany(products);
        console.log('Data Imported!');
        process.exit();
    } catch (err) {
        console.error('Error importing data:', err);
        process.exit(1);
    }
};

// Delete data from DB
const deleteData = async () => {
    try {
        await Product.deleteMany();
        console.log('Data Destroyed!');
        process.exit();
    } catch (err) {
        console.error('Error destroying data:', err);
        process.exit(1);
    }
};

// Command line arguments
if (process.argv[2] === '-i') {
    importData();
} else if (process.argv[2] === '-d') {
    deleteData();
} else {
    console.log('Please use the -i flag to import data or -d to delete data.');
    process.exit();
} 