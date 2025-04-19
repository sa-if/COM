require('dotenv').config(); // Load environment variables first
const express = require('express');
const path = require('path');
const session = require('express-session'); // Import express-session
const MongoStore = require('connect-mongo'); // Import connect-mongo
const connectDB = require('../config/db'); // Import DB connection function
const Product = require('../models/Product'); // Import Product model
const Order = require('../models/Order'); // Import Order model
const User = require('../models/User'); // Import User model
const bcrypt = require('bcryptjs'); // Import bcrypt
const { Parser } = require('json2csv');

// Connect to Database
connectDB();

// --- Remove Mock Data ---
// const products = [ ... ]; // Remove this mock array

const app = express();
const port = process.env.PORT || 3000; // Use port from .env

// Middleware
app.use(express.json()); // Needed to parse JSON request bodies for cart API
app.use(express.urlencoded({ extended: false })); // Needed for form data potentially

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret_key', // Use secret from .env
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Set to false - don't save unmodified sessions
  store: MongoStore.create({ 
      mongoUrl: process.env.MONGODB_URI, // Use your MongoDB connection string
      collectionName: 'sessions', // Optional: Name of the sessions collection
      ttl: 14 * 24 * 60 * 60 // Optional: Session TTL (e.g., 14 days). Default is 14 days.
  }),
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true, // Prevent client-side JS from reading the cookie
    maxAge: 1000 * 60 * 60 * 24, // Cookie expiry (e.g., 1 day) - Should match session TTL or be less
    sameSite: 'lax' // Recommended for security and cross-site request handling
  } 
}));

// Initialize cart in session if it doesn't exist
app.use((req, res, next) => {
  if (!req.session.cart) {
    req.session.cart = { items: [], totalQuantity: 0, totalPrice: 0 };
  }
  next();
});

// Serve static files from the 'Code' directory
app.use(express.static(path.join(__dirname, '../Code')));

// Route for the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Code', 'index.html'));
});

// Route for the checkout page
app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, '../Code', 'checkout.html'));
});

// Route for the admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../Code', 'admin.html'));
});

// Route for the profile page (Add this)
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, '../Code', 'profile.html'));
});

// Route for the order history page (Add this)
app.get('/order-history', (req, res) => {
    res.sendFile(path.join(__dirname, '../Code', 'order-history.html'));
});

// API endpoint to get products from DB
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find(); // Fetch all products from MongoDB
    // Important: Mongoose returns documents with _id. Frontend script.js currently expects 'id'.
    // We need to map the response to match the expected structure.
    const productsWithId = products.map(p => ({
      id: p._id.toString(), // Convert ObjectId to string for consistency
      name: p.name,
      description: p.description,
      price: p.price,
      image: p.image
      // Add other fields if necessary
    }));
    res.json(productsWithId);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ message: 'Server error while fetching products' });
  }
});

// --- Authentication Middleware --- (Add this)
const protect = async (req, res, next) => {
  if (req.session.user && req.session.user._id) {
    try {
      // Attach user document to the request (excluding password)
      req.user = await User.findById(req.session.user._id).select('-password');
      if (!req.user) {
         // User in session but not found in DB (corrupt session?), clear session
         return req.session.destroy(err => {
             res.clearCookie('connect.sid');
             return res.status(401).json({ message: 'Not authorized, user not found' });
         });
      }
      next(); // User found, proceed
    } catch (error) {
      console.error("Error fetching user in protect middleware:", error);
      return res.status(500).json({ message: 'Server error during authorization' });
    }
  } else {
    // No user in session
    res.status(401).json({ message: 'Not authorized, no login session' });
  }
};

// --- Helper function to calculate cart totals --- (Add this)
function calculateCartTotals(items = []) {
    let totalQuantity = 0;
    let totalPrice = 0;
    items.forEach(item => {
        totalQuantity += item.quantity;
        totalPrice += item.price * item.quantity;
    });
    return { totalQuantity, totalPrice };
}

// --- Cart API Routes --- (Updated for DB Persistence)

// Get current cart (user DB cart or anonymous session cart)
app.get('/api/cart', async (req, res) => {
  if (req.session.user && req.session.user._id) {
    try {
      const user = await User.findById(req.session.user._id).select('cart');
      if (!user) {
          return res.status(404).json({ message: "User not found"});
      }
      const cartItems = user.cart.items || [];
      const totals = calculateCartTotals(cartItems);
      res.json({ items: cartItems, ...totals });
    } catch (error) {
        console.error("Error fetching user cart:", error);
        res.status(500).json({ message: "Server error fetching cart" });
    }
  } else {
    // Anonymous user: use session cart
    if (!req.session.cart) {
      req.session.cart = { items: [], totalQuantity: 0, totalPrice: 0 };
    }
    res.json(req.session.cart);
  }
});

// Add item to cart (user DB cart or anonymous session cart)
app.post('/api/cart/add', async (req, res) => {
  const { productId, quantity } = req.body;
  const qty = quantity ? parseInt(quantity) : 1;
  
  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const cartItemData = {
        productId: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: qty
    };

    if (req.session.user && req.session.user._id) {
      // --- Logged-in User: Update DB Cart --- 
      const user = await User.findById(req.session.user._id);
      if (!user) return res.status(404).json({ message: "User not found"});
      
      const existingItemIndex = user.cart.items.findIndex(item => item.productId.equals(productId));

      if (existingItemIndex > -1) {
          user.cart.items[existingItemIndex].quantity += qty;
      } else {
          user.cart.items.push(cartItemData);
      }
      await user.save(); // Save updated user document
      
      const totals = calculateCartTotals(user.cart.items);
      res.json({ items: user.cart.items, ...totals }); // Return updated cart

    } else {
      // --- Anonymous User: Update Session Cart --- 
      if (!req.session.cart) {
          req.session.cart = { items: [], totalQuantity: 0, totalPrice: 0 };
      }
      const cart = req.session.cart;
      const existingItemIndex = cart.items.findIndex(item => item.productId === productId); // Session uses string ID
      
       if (existingItemIndex > -1) {
          cart.items[existingItemIndex].quantity += qty;
      } else {
           // In session, store productId as string for simplicity if needed, though mongoose ID might work
           cart.items.push({ ...cartItemData, productId: productId }); 
      }
      const totals = calculateCartTotals(cart.items);
      req.session.cart = { items: cart.items, ...totals }; // Update session cart
      
      req.session.save(err => {
          if (err) { /* handle error */ return res.status(500).json({message: 'Session error'}); }
          res.json(req.session.cart);
      });
    }

  } catch (err) {
    console.error("Error adding item to cart:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove item from cart (user DB or anonymous session)
app.post('/api/cart/remove', async (req, res) => {
    const { productId } = req.body;

    if (req.session.user && req.session.user._id) {
        // --- Logged-in User: Update DB Cart --- 
        try {
            const user = await User.findById(req.session.user._id);
            if (!user) return res.status(404).json({ message: "User not found"});

            const initialLength = user.cart.items.length;
            user.cart.items = user.cart.items.filter(item => !item.productId.equals(productId));

            if (user.cart.items.length === initialLength) {
                return res.status(404).json({ message: "Item not found in user cart" });
            }

            await user.save();
            const totals = calculateCartTotals(user.cart.items);
            res.json({ items: user.cart.items, ...totals });
        } catch (err) {
            console.error("Error removing item from user cart:", err);
            res.status(500).json({ message: 'Server error' });
        }
    } else {
        // --- Anonymous User: Update Session Cart --- 
        if (!req.session.cart || !req.session.cart.items) {
            return res.status(404).json({ message: 'Cart not found or empty' });
        }
        const cart = req.session.cart;
        const initialLength = cart.items.length;
        cart.items = cart.items.filter(item => item.productId !== productId); // Compare string IDs

        if (cart.items.length === initialLength) {
             return res.status(404).json({ message: "Item not found in session cart" });
        }
        
        const totals = calculateCartTotals(cart.items);
        req.session.cart = { items: cart.items, ...totals };
        
        req.session.save(err => {
            if (err) { /* handle error */ return res.status(500).json({message: 'Session error'}); }
            res.json(req.session.cart);
        });
    }
});

// Clear cart (user DB or anonymous session)
app.delete('/api/cart', async (req, res) => {
     if (req.session.user && req.session.user._id) {
        // --- Logged-in User: Clear DB Cart --- 
        try {
            const user = await User.findById(req.session.user._id);
            if (!user) return res.status(404).json({ message: "User not found"});
            user.cart.items = []; // Empty the items array
            await user.save();
             res.json({ items: [], totalQuantity: 0, totalPrice: 0 }); // Return empty cart
        } catch (err) {
             console.error("Error clearing user cart:", err);
            res.status(500).json({ message: 'Server error' });
        }
     } else {
         // --- Anonymous User: Clear Session Cart --- 
         req.session.cart = { items: [], totalQuantity: 0, totalPrice: 0 };
         req.session.save(err => {
            if (err) { /* handle error */ return res.status(500).json({message: 'Session error'}); }
            res.json(req.session.cart);
         });
     }
});

console.log("Defining Auth API routes..."); // <-- ADD THIS LOG
// --- Authentication API Routes --- (Add these)

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  console.log("--- Received POST /api/auth/register ---"); // Log start
  const { name, email, password } = req.body;
  console.log("Registration Request Body:", req.body); // Log body

  // Basic validation
  if (!name || !email || !password) {
    console.log("Registration validation failed: Missing fields");
    return res.status(400).json({ message: 'Please provide name, email, and password' });
  }
  if (password.length < 6) {
      console.log("Registration validation failed: Password too short");
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    console.log(`Checking for existing user with email: ${email.toLowerCase()}`);
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log(`Registration failed: Email ${email.toLowerCase()} already registered`);
      return res.status(400).json({ message: 'Email already registered' });
    }

    console.log(`Email ${email.toLowerCase()} is available. Creating user...`);
    // Create user (password hashing happens in pre-save hook)
    const user = await User.create({
      name,
      email,
      password
    });
    console.log(`User created successfully: ${user._id}`);

    // Don't log in user immediately, require separate login
    console.log("Sending registration success response.");
    res.status(201).json({ message: 'User registered successfully. Please log in.' }); 

  } catch (err) {
    console.error("--- ERROR IN /api/auth/register ROUTE ---", err); // Log the caught error clearly
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: 'Registration validation failed', errors: err.errors });
    }
    // Send generic server error JSON to prevent HTML response
    res.status(500).json({ message: 'Server error during registration' }); 
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  try {
    // Find user by email, explicitly include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password cart');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' }); // User not found
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' }); // Password mismatch
    }

    // --- Login Success: Store user in session --- 
    req.session.user = { _id: user._id, name: user.name, email: user.email };

    // --- Handle Cart Merging (Session -> DB) --- 
    let anonymousCart = req.session.cart || { items: [] };
    let userCartItems = user.cart.items || []; // Get user's DB cart items

    if (anonymousCart.items.length > 0) {
        console.log("Merging anonymous cart into user DB cart...");
        anonymousCart.items.forEach(anonItem => {
            // Find product details again to ensure consistency
            // const product = await Product.findById(anonItem.productId); // Optional: re-validate product
            // if(!product) return; 
            
            const existingIndex = userCartItems.findIndex(userItem => userItem.productId.equals(anonItem.productId));
            if (existingIndex > -1) {
                userCartItems[existingIndex].quantity += anonItem.quantity;
            } else {
                // Add item data from anonymous cart (ensure productId is ObjectId)
                userCartItems.push({
                    productId: anonItem.productId, // Assume it's stored correctly in session
                    name: anonItem.name, 
                    price: anonItem.price,
                    image: anonItem.image,
                    quantity: anonItem.quantity
                });
            }
        });
        user.cart.items = userCartItems; // Update user object
        await user.save(); // Save merged cart to DB
        console.log("User DB cart updated with merged items.");
        
        // Clear anonymous session cart after merging
        req.session.cart = { items: [], totalQuantity: 0, totalPrice: 0 };
    }
    // ---- End Cart Merging ----
    
    const finalUserCartItems = user.cart.items;
    const finalTotals = calculateCartTotals(finalUserCartItems);

    req.session.save(err => {
        if (err) { /* ... error handling ... */ }
        res.json({ 
            _id: user._id, 
            name: user.name, 
            email: user.email, 
            cart: { items: finalUserCartItems, ...finalTotals } // Send final DB cart state
        });
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  // Destroy the entire session
  req.session.destroy(err => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: 'Could not log out, please try again' });
    }
    // Clear the session cookie
    res.clearCookie('connect.sid'); // Default session cookie name used by express-session
    res.json({ message: 'Logged out successfully' });
  });
});

// GET /api/auth/me (Updated to send DB cart if logged in)
app.get('/api/auth/me', async (req, res) => { // Made async
  if (req.session.user && req.session.user._id) {
      try {
         // Fetch user with cart data
         const user = await User.findById(req.session.user._id).select('name email cart');
         if (!user) {
            // Should not happen if session is valid, but handle anyway
             return res.status(404).json({ message: "User not found"});
         }
         const cartItems = user.cart.items || [];
         const totals = calculateCartTotals(cartItems);
         res.json({ 
             user: { _id: user._id, name: user.name, email: user.email }, 
             cart: { items: cartItems, ...totals } 
         });
      } catch (error) {
          console.error("Error fetching user data for /me route:", error);
          res.status(500).json({ message: "Server error" });
      }
  } else {
    // Anonymous: Send session cart
    res.json({ 
        user: null, 
        cart: req.session.cart || { items: [], totalQuantity: 0, totalPrice: 0 } 
    });
  }
});

// --- User's Own Orders API Route --- (Add this)

// GET /api/orders/my - Fetch orders for the logged-in user
app.get('/api/orders/my', protect, async (req, res) => {
  console.log(`--- Received GET /api/orders/my for user ${req.user._id} ---`);
  try {
    const orders = await Order.find({ user: req.user._id })
                                .sort({ orderDate: -1 }) // Sort newest first
                                .lean(); // Use lean for potentially better performance if not modifying

    console.log(`Found ${orders.length} orders for user ${req.user._id}`);
    res.json(orders);

  } catch (err) {
    console.error(`Error fetching orders for user ${req.user._id}:`, err);
    res.status(500).json({ message: 'Server error while fetching your orders' });
  }
});

// --- Order API Route --- 

app.post('/api/orders', async (req, res) => {
  console.log("--- Received POST /api/orders ---");
  
  // --- Login Check --- (Existing)
  if (!req.session.user || !req.session.user._id) { // Added check for _id for robustness
      console.log("Order attempt rejected: User not logged in.");
      return res.status(401).json({ message: 'You must be logged in to place an order.' });
  }
  const userId = req.session.user._id;
  const userIdLog = `user ${userId}`;
  console.log(`Processing order for ${userIdLog}`);
  // --- End Login Check ---

  const { 
      customerName, 
      email, 
      phone, 
      address, 
      paymentMethod, 
      paymentNumber, 
      transactionId  
  } = req.body;
  console.log("Request Body:", req.body);

  try {
    // --- Fetch User's Cart from Database --- (Add this section)
    const user = await User.findById(userId).select('cart');
    if (!user) {
        console.error(`Order Error: User ${userId} not found in DB.`);
        // Optionally clear session if user doesn't exist?
        return res.status(404).json({ message: "User not found. Please log in again." });
    }
    const userCart = user.cart || { items: [] }; // Use user's DB cart
    const cartItems = userCart.items;
    const { totalPrice } = calculateCartTotals(cartItems); // Calculate total from DB items
    console.log(`Fetched DB cart for ${userIdLog}. Items: ${cartItems.length}, Total: ${totalPrice}`);
    // --- End Fetch User's Cart ---

    // Basic Validation (Updated to check fetched cartItems)
    if (!customerName || !email || !phone || !address || !paymentMethod) {
      return res.status(400).json({ message: 'Missing required customer or payment method information' });
    }
    if (paymentMethod === 'Bkash' && (!paymentNumber || !transactionId)) {
        return res.status(400).json({ message: 'Bkash Number and Transaction ID are required for Bkash payments.' });
    }
    // Check the fetched cart items
    if (!cartItems || cartItems.length === 0) {
      console.log(`Order attempt failed for ${userIdLog}: Empty DB cart`);
      return res.status(400).json({ message: 'Cannot place an order with an empty cart' });
    }
    // --- End Validation ---

    console.log("Validation passed. Preparing order items from DB cart...");
    const orderItems = cartItems.map(item => ({
      productId: item.productId, 
      name: item.name,
      price: item.price,
      quantity: item.quantity
    }));
    console.log("Mapped Order Items:", JSON.stringify(orderItems, null, 2)); 

    // Create new order data object (Use calculated totalPrice)
    const newOrderData = {
      user: userId, // Associate order with user ID
      customerName,
      email,
      phone,
      address,
      items: orderItems,
      totalAmount: totalPrice, // Use total calculated from DB cart
      paymentMethod: paymentMethod,
      customerIP: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    };
    
    // --- Remove Redundant User ID Check ---
    // if (isUserLoggedIn) { // Already know user is logged in
    //   newOrderData.user = req.session.user._id;
    //   console.log(`Associating order with user ID: ${newOrderData.user}`);
    // }
    // --- End Remove Redundant Check ---

    // Add Bkash details conditionally
    if (paymentMethod === 'Bkash') {
      newOrderData.paymentNumber = paymentNumber;
      newOrderData.transactionId = transactionId;
    }

    const newOrder = new Order(newOrderData);
    console.log("New Order Object (Before Save):", JSON.stringify(newOrder.toObject(), null, 2)); 

    // Save order to database
    console.log("Attempting to save order...");
    const savedOrder = await newOrder.save();
    console.log("Order Saved Successfully:", JSON.stringify(savedOrder.toObject(), null, 2)); 

    // --- Clear the User's Database Cart --- (Modify this)
    console.log(`Clearing DB cart for ${userIdLog}`);
    user.cart.items = []; // Empty the items array in the user document
    await user.save(); // Save the user document with the cleared cart
    console.log(`DB cart cleared for ${userIdLog}.`);
    // --- End Clear DB Cart ---

    // --- Keep Session Save (Optional but good practice) ---
    // Although the primary cart data was in the DB, saving the session 
    // ensures any other potential session changes are persisted.
    req.session.save(err => {
      if (err) {
        console.error("Session save error after order placement:", err);
        // Note: Error here doesn't stop the success response, but worth logging
      }
      console.log("Session saved (post-order). Sending success response.");
      res.status(201).json({ message: 'Order placed successfully!', orderId: savedOrder._id });
    });
    // --- End Session Save ---

  } catch (err) {
    console.error(`--- ERROR IN /api/orders ROUTE FOR ${userIdLog} ---`, err); 
    // Handle validation errors from Mongoose model
    if (err.name === 'ValidationError') {
        // Send specific validation error JSON
        return res.status(400).json({ message: 'Order validation failed', errors: err.errors });
    }
    // Send generic server error JSON
    res.status(500).json({ message: 'Server error while placing order' });
     // **** IMPORTANT: Avoid letting Express send default HTML ****
  }
});

// --- Admin Auth Middleware --- (Add this)
const protectAdmin = (req, res, next) => {
  const apiKey = req.headers['x-admin-api-key']; // Check for key in header
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or missing Admin API Key' });
  }
  next(); // Key is valid, proceed to the route
};

// --- Admin API Routes --- (Add these)

// -- Product Management --

// GET all products (Admin)
app.get('/api/admin/products', protectAdmin, async (req, res) => {
  try {
    const products = await Product.find();
    // Send raw product data including _id for admin use
    res.json(products);
  } catch (err) {
    console.error("Admin: Error fetching products:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST create new product (Admin)
app.post('/api/admin/products', protectAdmin, async (req, res) => {
  const { name, description, price, image } = req.body;
  if (!name || !description || price == null || !image) {
    return res.status(400).json({ message: 'Missing required product fields' });
  }
  try {
    const newProduct = new Product({ name, description, price, image });
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (err) {
    console.error("Admin: Error creating product:", err);
     if (err.name === 'ValidationError') {
        return res.status(400).json({ message: 'Product validation failed', errors: err.errors });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update product (Admin)
app.put('/api/admin/products/:id', protectAdmin, async (req, res) => {
  const { name, description, price, image } = req.body;
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Update fields if provided
    if (name) product.name = name;
    if (description) product.description = description;
    if (price != null) product.price = price;
    if (image) product.image = image;

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (err) {
    console.error("Admin: Error updating product:", err);
     if (err.name === 'ValidationError') {
        return res.status(400).json({ message: 'Product validation failed', errors: err.errors });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE product (Admin)
app.delete('/api/admin/products/:id', protectAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error("Admin: Error deleting product:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

// -- Order Management --

// GET all orders (Admin) - Updated for date filter based on Local Interpretation (UTC+6)
app.get('/api/admin/orders', protectAdmin, async (req, res) => {
  console.log("--- Received GET /api/admin/orders ---");
  console.log("Query Params:", req.query);
  try {
    const { date: filterDate } = req.query; // Only look for date 
    let query = {};
    let appliedFilters = []; 

    // --- Date Filter --- (Keep this)
    if (filterDate) {
      console.log(`Admin: Applying date filter: ${filterDate}`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(filterDate)) { 
           console.warn("Admin: Invalid date format received.");
      } else {
          try {
            const startDateLocalStr = `${filterDate}T00:00:00.000+06:00`; 
            const startDate = new Date(startDateLocalStr);
            const endDate = new Date(startDate.getTime());
            endDate.setUTCDate(endDate.getUTCDate() + 1);
            endDate.setUTCMilliseconds(endDate.getUTCMilliseconds() - 1);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                 throw new Error('Invalid date value resulting in NaN.');
            }
            query.orderDate = { $gte: startDate, $lte: endDate };
            appliedFilters.push(`Date='${filterDate}'`);
          } catch (dateError) {
              console.error("Admin: Error processing date for filter:", dateError);
          }
      }
    }

    // --- Remove Email, Phone, Bkash Filters ---
    // REMOVED emailFilter logic
    // REMOVED phoneFilter logic
    // REMOVED bkashNumberFilter logic
    // --- End Remove Filters ---

    // Log the final query being used
    if (appliedFilters.length > 0) {
        console.log("Admin: Final query filters:", appliedFilters.join(', '));
        console.log("Admin: MongoDB Query Object:", JSON.stringify(query));
    } else {
         console.log("Admin: Fetching all orders (no filters applied).");
    }

    // Find orders matching the query, sort newest first
    const orders = await Order.find(query).sort({ orderDate: -1 }); 
    
    // Log fetched order dates for debugging
    if(!filterDate && orders.length > 0) { /* ... existing logging ... */ }
    // ... existing logging ...
    
    res.json(orders);
    
  } catch (err) {
    console.error("Admin: Error fetching orders:", err);
    res.status(500).json({ message: 'Server error while fetching orders' });
  }
});

// GET export orders (Admin) - Add this route
app.get('/api/admin/orders/export', protectAdmin, async (req, res) => {
  console.log("--- Received GET /api/admin/orders/export ---");
  console.log("Export Query Params:", req.query);
  try {
    const { date: filterDate } = req.query; // Only look for date
    let query = {};
    let appliedFilters = []; // Track filters

    // --- Replicate date filtering logic from GET /api/admin/orders --- 
    if (filterDate) {
      console.log(`Admin Export: Applying date filter: ${filterDate}`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(filterDate)) {
           console.warn("Admin Export: Invalid date format received.");
      } else {
          try {
              const startDateLocalStr = `${filterDate}T00:00:00.000+06:00`; 
              const startDate = new Date(startDateLocalStr);
              const endDate = new Date(startDate.getTime()); 
              endDate.setUTCDate(endDate.getUTCDate() + 1);
              endDate.setUTCMilliseconds(endDate.getUTCMilliseconds() - 1);

              if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                  throw new Error('Invalid date value resulting in NaN.');
              }
              query.orderDate = { $gte: startDate, $lte: endDate };
              appliedFilters.push(`Date='${filterDate}'`);
          } catch (dateError) {
               console.error("Admin Export: Error processing date for filter:", dateError);
          }
      }
    }
    
    // --- Remove Email, Phone, Bkash Filters ---
    // REMOVED emailFilter logic
    // REMOVED phoneFilter logic
    // REMOVED bkashNumberFilter logic
    // --- End Remove Filters ---

    // Log applied filters for export
    if (appliedFilters.length > 0) {
        console.log("Admin Export: Final query filters:", appliedFilters.join(', '));
        console.log("Admin Export: MongoDB Query Object:", JSON.stringify(query));
    } else {
         console.log("Admin Export: Exporting all orders (no filters applied).");
    }

    const orders = await Order.find(query).sort({ orderDate: -1 }).lean(); // Use lean() for plain objects

    if (orders.length === 0) {
         return res.status(404).send('No orders found for the specified criteria.');
    }

    // --- Prepare data for CSV --- 
    const fields = [
        { label: 'Order_ID', value: '_id' },
        { label: 'Date', value: row => new Date(row.orderDate).toLocaleString() }, 
        { label: 'Customer_Name', value: 'customerName' },
        { label: 'Email', value: 'email' },
        { label: 'Phone', value: 'phone' },
        { label: 'Address', value: 'address' },
        { label: 'Total_Amount', value: 'totalAmount' },
        { label: 'Status', value: 'status' },
        { label: 'Payment_Method', value: 'paymentMethod' },
        { label: 'Bkash_Number', value: 'paymentNumber' },
        { label: 'Bkash_TxID', value: 'transactionId' },
        // Flatten items array into a single string column
        { label: 'Items', value: row => (row.items || []).map(item => `${item.name} (ID: ${item.productId}, Qty: ${item.quantity}, Price: ${item.price})`).join('; ') },
        { label: 'User_ID', value: 'user' },
        { label: 'IP_Address', value: 'customerIP' }
    ];

    const json2csvParser = new Parser({ fields, excelStrings: true }); // Use excelStrings for better compatibility
    const csv = json2csvParser.parse(orders);

    // --- Send CSV response --- 
    const fileNameDate = filterDate ? filterDate : 'all-dates';
    const fileName = `orders-${fileNameDate}.csv`;

    res.header('Content-Type', 'text/csv');
    res.attachment(fileName); // Suggests filename for download
    res.send(csv);
    console.log(`Admin Export: Sent ${fileName} for download.`);

  } catch (err) {
    console.error("Admin Export: Error exporting orders:", err);
    res.status(500).send('Server error during order export');
  }
});

// GET specific order (Admin) - Moved AFTER the /export route
app.get('/api/admin/orders/:id', protectAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.productId', 'name image'); // Optionally populate product details
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    console.error("Admin: Error fetching order:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update order status (Admin)
app.put('/api/admin/orders/:id/status', protectAdmin, async (req, res) => {
  const { status } = req.body;
  // Validate status against the enum defined in the Order model
  if (!Order.schema.path('status').enumValues.includes(status)){
      return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    const updatedOrder = await order.save();
    res.json(updatedOrder);

  } catch (err) {
    console.error("Admin: Error updating order status:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

// -- User Management -- (Add this section)

// GET all users (Admin - excludes password)
app.get('/api/admin/users', protectAdmin, async (req, res) => {
  try {
    // Find users, explicitly exclude password field just in case
    const users = await User.find().select('-password').sort({ createdAt: -1 }); 
    res.json(users);
  } catch (err) {
    console.error("Admin: Error fetching users:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Profile API Routes --- (Add these)

// GET /api/profile - Get logged-in user's profile
app.get('/api/profile', protect, async (req, res) => {
    // The 'protect' middleware already attached the user document to req.user
    // We exclude password and cart for this profile route
    try {
        // Re-fetch to ensure fresh data? Or use req.user if sufficient.
        const userProfile = await User.findById(req.user._id).select('name email phone address profilePicUrl createdAt');
        if (!userProfile) {
             return res.status(404).json({ message: "User not found" });
        }
        res.json(userProfile);
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// PUT /api/profile - Update logged-in user's profile
app.put('/api/profile', protect, async (req, res) => {
    // Fields allowed to be updated
    const { name, phone, address, profilePicUrl } = req.body;

    try {
        // req.user is attached by the 'protect' middleware
        const user = req.user; 

        // Update fields if they were provided in the request body
        if (name !== undefined) user.name = name.trim();
        if (phone !== undefined) user.phone = phone.trim();
        if (address !== undefined) user.address = address.trim();
        if (profilePicUrl !== undefined) user.profilePicUrl = profilePicUrl.trim();
        
        // Add basic validation if needed (e.g., for phone format)
        // if (phone && !isValidPhoneNumber(phone)) { return res.status(400).json(...); }

        const updatedUser = await user.save();

        // Send back relevant updated profile info (exclude password, cart etc.)
        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email, 
            phone: updatedUser.phone,
            address: updatedUser.address,
            profilePicUrl: updatedUser.profilePicUrl
        });

    } catch (err) {
        console.error("Profile update error:", err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: 'Profile update validation failed', errors: err.errors });
        }
        res.status(500).json({ message: 'Server error during profile update' });
    }
});

// app.listen(port, () => {
//   console.log(`Server listening at http://localhost:${port}`);
// }); 

module.exports = app; // Export the app instance for Vercel 
