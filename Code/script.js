let products = []; // Will be fetched from the server
// let cart = []; // Remove local cart management

// --- Global State ---
let currentCart = { items: [], totalQuantity: 0, totalPrice: 0 }; // Holds current cart (user or anon)
let currentUser = null; // Holds logged-in user info

// --- DOM Elements (Add Auth related) ---
const userStatusEl = document.getElementById('user-status');
const userNameEl = document.getElementById('user-name');
const guestActionsEl = document.getElementById('guest-actions');
const loginLink = document.getElementById('login-link');
const registerLink = document.getElementById('register-link');
const logoutButton = document.getElementById('logout-button');

const loginModal = document.getElementById('login-modal');
const registerModal = document.getElementById('register-modal');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginErrorEl = document.getElementById('login-error');
const registerErrorEl = document.getElementById('register-error');
const registerSuccessEl = document.getElementById('register-success');

// Get all close buttons for modals
const closeButtons = document.querySelectorAll('.close-button');

async function fetchProducts() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    products = await response.json(); // Store fetched products globally
    displayProducts(); // Display products after fetching
  } catch (error) {
    console.error("Failed to fetch products:", error);
    // Optionally display an error message to the user
    const productsContainer = document.getElementById("products-container");
    productsContainer.innerHTML = "<p>Failed to load products. Please try again later.</p>";
  }
}

function displayProducts() {
  const productsContainer = document.getElementById("products-container");
  if (!productsContainer) return;
  productsContainer.innerHTML = ''; // Clear previous products
  products.forEach(product => {
    const productDiv = document.createElement("div");
    productDiv.classList.add("product");

    const img = document.createElement("img");
    img.src = product.image || 'placeholder.png';
    img.alt = product.name;
    productDiv.appendChild(img);

    const productInfoDiv = document.createElement("div");
    productInfoDiv.classList.add("product-info");

    const productName = document.createElement("h3");
    productName.classList.add("product-name");
    productName.textContent = product.name;
    productInfoDiv.appendChild(productName);

    const productDescription = document.createElement("p");
    productDescription.classList.add("product-description");
    productDescription.textContent = product.description;
    productInfoDiv.appendChild(productDescription);

    const productPrice = document.createElement("p");
    productPrice.classList.add("product-price");
    productPrice.textContent = `$${product.price.toFixed(2)}`;
    productInfoDiv.appendChild(productPrice);

    const addButton = document.createElement("button");
    addButton.textContent = "Add to Cart";
    addButton.dataset.productId = product.id;
    addButton.addEventListener("click", handleAddToCart);
    productInfoDiv.appendChild(addButton);

    productDiv.appendChild(productInfoDiv);
    productsContainer.appendChild(productDiv);
  });
}

// --- New Cart Functions ---
async function fetchCart() {
  try {
    const response = await fetch('/api/cart');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const cartData = await response.json();
    displayCart(cartData);
    // Also update summary if on checkout page?
    if (document.getElementById('orderForm')) { 
      updateFormSummary(cartData);
    }
  } catch (error) {
    console.error("Failed to fetch cart:", error);
    // Handle error display if needed
  }
}

function displayCart(cart) {
  currentCart = cart; // Update global reference
  const cartItemsList = document.getElementById("cart-items");
  const cartTotalDisplay = document.getElementById("cart-total");
  if (!cartItemsList || !cartTotalDisplay) {
      console.warn("Cart display elements not found on this page.");
      return; 
  }
  cartItemsList.innerHTML = "";
  if (currentCart && currentCart.items) {
    currentCart.items.forEach(item => {
      const listItem = document.createElement("li");
      // Note: item structure comes from server now (item.productId, item.name, etc.)
      listItem.innerHTML = `<span>${item.name} x ${item.quantity}</span>
                            <span>$${(item.price * item.quantity).toFixed(2)}</span>`;
      
      const removeButton = document.createElement("button");
      removeButton.textContent = "Remove";
      removeButton.classList.add("btn", "btn-remove");
      // Pass the correct product ID (which is a string from MongoDB _id)
      removeButton.addEventListener("click", () => handleRemoveFromCart(item.productId)); 
      listItem.appendChild(removeButton);

      cartItemsList.appendChild(listItem);
    });
    cartTotalDisplay.textContent = `Total: $${currentCart.totalPrice.toFixed(2)}`;
  } else {
     cartTotalDisplay.textContent = `Total: $0.00`;
  }
}

// Modified addToCart
async function handleAddToCart(event) {
  const productId = event.target.dataset.productId;
  try {
    const response = await fetch('/api/cart/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId: productId, quantity: 1 })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    currentCart = await response.json(); // Update global cart
    displayCart(currentCart);

  } catch (error) {
    console.error("Failed to add item to cart:", error);
    alert(`Error adding item: ${error.message}`);
  }
}

// Modified removeFromCart (renamed for clarity)
async function handleRemoveFromCart(productId) {
  try {
    const response = await fetch('/api/cart/remove', {
      method: 'POST', // Using POST as defined in server.js
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId: productId })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    currentCart = await response.json(); // Update global cart
    displayCart(currentCart);
    updateFormSummary(currentCart); // Update summary if needed immediately

  } catch (error) {
    console.error("Failed to remove item from cart:", error);
    alert(`Error removing item: ${error.message}`);
  }
}

// --- Update existing functions to use new cart handlers/data ---

function updateFormSummary(cartToSummarize = currentCart) { // Now accepts cart data
  const cartSummaryDiv = document.getElementById("cart-summary-for-form");
  const formTotalInput = document.getElementById("formTotalAmount");
  const formItemsTextarea = document.getElementById("formItems");
  if (!cartSummaryDiv || !formTotalInput || !formItemsTextarea) return; // Only run if elements exist

  let itemsDescription = "";
  cartSummaryDiv.innerHTML = "<h3>Order Summary:</h3><ul>";

  if (cartToSummarize && cartToSummarize.items) {
    cartToSummarize.items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      cartSummaryDiv.innerHTML += `<li>${item.name} x ${item.quantity} - $${itemTotal.toFixed(2)}</li>`;
      itemsDescription += `${item.name} x ${item.quantity}, `;
    });
    cartSummaryDiv.innerHTML += "</ul>";
    formTotalInput.value = cartToSummarize.totalPrice.toFixed(2);
    formItemsTextarea.value = itemsDescription.length > 0 ? itemsDescription.slice(0, -2) : "";
  } else {
     // Handle empty cart case for form summary
     cartSummaryDiv.innerHTML += "<li>No items in cart.</li></ul>";
     formTotalInput.value = "0.00";
     formItemsTextarea.value = "";
  }
}

// --- Event Listeners and Initialization ---

// Navigation between Shop and Checkout pages
document.getElementById("nav-shop")?.addEventListener("click", () => {
  // Check if we are on the main shop page (by checking for products-container)
  if (document.getElementById('products-container')) {
    // If shop sections exist, toggle them (original logic, might be redundant now)
    const shopPage = document.getElementById("shop-page");
    const checkoutPage = document.getElementById("checkout-page");
    if (shopPage && checkoutPage) {
      shopPage.style.display = "block";
      checkoutPage.style.display = "none";
    }
    // If only using index.html, no action might be needed here 
    // besides ensuring the user is scrolled to the top or products section.
  } else {
    // If not on the main shop page (e.g., on checkout.html or admin.html), navigate home.
    window.location.href = '/'; // Navigate to the root (homepage)
  }
});

document.getElementById("checkout-button")?.addEventListener("click", async () => {
  // --- Login Check (Frontend) --- (Add this)
  if (!currentUser) {
    alert("Please log in or register to proceed to checkout.");
    showModal('login-modal'); // Optionally open login modal directly
    return;
  }
  // --- End Login Check ---

  // Fetch the latest cart state before going to checkout (user must be logged in now)
  try {
    // Use userCart directly if confident currentUser implies userCart exists
    // Or fetch /api/cart which now returns userCart if logged in
    const cartData = currentCart; // Assuming fetchCurrentUserStatus updated this
    
    if (!cartData || cartData.items.length === 0) {
      alert("Please add at least one item to your cart before proceeding to checkout.");
      return;
    }
    // No need to use localStorage anymore, checkout page will fetch cart
    window.location.href = "checkout.html";
  } catch (error) {
      console.error("Error preparing for checkout:", error);
      alert("Could not retrieve cart information. Please try again.");
  }
});

// Order form submission (modified to use backend API and include payment details)
document.getElementById("orderForm")?.addEventListener("submit", async function(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const paymentMethod = formData.get("paymentMethod");
  
  // Consolidate all data to be sent
  const orderPayload = {
      customerName: formData.get("customerName").trim(),
      email: formData.get("email").trim(),
      phone: formData.get("phone").trim(),
      address: formData.get("address").trim(),
      paymentMethod: paymentMethod // Always include payment method
  };

  // --- Client-side validation (Keep or enhance) ---
  if (!orderPayload.customerName || orderPayload.customerName.split(" ").length < 2) {
    alert("Please enter your full name (first and last name).");
    return;
  }
  if (!orderPayload.email.includes('@')) {
    alert("Please enter a valid email address containing '@'.");
    return;
  }
  const bdPhoneRegex = /^(?:\+?8801|01)[3-9]\d{8}$/;
  if (!bdPhoneRegex.test(orderPayload.phone)) {
    alert("Please enter a valid Bangladeshi phone number.");
    return;
  }
  if (!orderPayload.address) {
    alert("Please enter your address.");
    return;
  }
  // --- End Validation ---

  // Add Bkash details if that method is selected
  if (paymentMethod === "Bkash") {
      orderPayload.paymentNumber = formData.get("paymentNumber")?.trim();
      orderPayload.transactionId = formData.get("transactionId")?.trim();
      // Add validation for Bkash fields if needed
      if (!orderPayload.paymentNumber || !orderPayload.transactionId) {
          alert("Please enter your Bkash Number and Transaction ID when selecting Bkash.");
          return;
      }
  }

  try {
    const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // Send the complete payload
        body: JSON.stringify(orderPayload) 
    });

    const result = await response.json();

    if (!response.ok) {
        // Handle errors from the server (e.g., validation errors, empty cart)
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }

    // Order placed successfully
    console.log("Order Success (Backend):", result);
    alert(`Order placed successfully! Order ID: ${result.orderId}`);
    
    // Reset the form
    event.target.reset();
    
    // Fetch the now-empty cart to update display (optional, session is cleared server-side)
    fetchCart(); 
    
    // Redirect to a thank you page or back to the shop
    window.location.href = 'index.html'; // Or a dedicated thank you page

  } catch (error) {
    console.error("Error submitting order:", error);
    alert(`Error submitting order: ${error.message}. Please try again.`);
  }
});

function hideOrderDetails() {
  // ... existing code ...
}

// --- Payment Option Toggle (for checkout page) ---
function initializePaymentOptions() {
  const paymentMethodSelect = document.getElementById("paymentMethod");
  const bkashSection = document.getElementById("bkash-section");
  
  if (paymentMethodSelect && bkashSection) { // Only run if elements exist
    paymentMethodSelect.addEventListener("change", () => {
      const paymentNumberInput = document.getElementById("paymentNumber");
      const transactionIdInput = document.getElementById("transactionId");

      if (paymentMethodSelect.value === "Bkash") {
        bkashSection.style.display = "block";
        // Optional: Add animation class if defined in CSS
        // bkashSection.classList.add("fade-in"); 
        if(paymentNumberInput) paymentNumberInput.required = true;
        if(transactionIdInput) transactionIdInput.required = true;
      } else { // COD selected or other
        bkashSection.style.display = "none";
        if(paymentNumberInput) paymentNumberInput.required = false;
        if(transactionIdInput) transactionIdInput.required = false;
      }
    });
    // Trigger change event on load in case default is Bkash (optional)
    // paymentMethodSelect.dispatchEvent(new Event('change'));
  }
}

// --- Utility Functions ---
function updateAuthUI() {
    // Check if elements exist before trying to modify them
    if (currentUser) {
        if (userNameEl) userNameEl.textContent = currentUser.name;
        if (userStatusEl) userStatusEl.style.display = 'inline'; 
        if (guestActionsEl) guestActionsEl.style.display = 'none';
    } else {
        if (userStatusEl) userStatusEl.style.display = 'none';
        if (guestActionsEl) guestActionsEl.style.display = 'inline'; 
    }
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'block';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
    // Clear any previous messages
    if(loginErrorEl) loginErrorEl.style.display = 'none';
    if(registerErrorEl) registerErrorEl.style.display = 'none';
    if(registerSuccessEl) registerSuccessEl.style.display = 'none';
}

function displayLoginError(message) {
    loginErrorEl.textContent = message;
    loginErrorEl.style.display = 'block';
}

function displayRegisterError(message) {
    registerErrorEl.textContent = message;
    registerErrorEl.style.display = 'block';
    registerSuccessEl.style.display = 'none';
}

function displayRegisterSuccess(message) {
    registerSuccessEl.textContent = message;
    registerSuccessEl.style.display = 'block';
    registerErrorEl.style.display = 'none';
}

// --- API Calls ---
// Fetches user status and associated cart
async function fetchCurrentUserStatus() {
    console.log("Checking auth status...");
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            // Don't throw error, just means not logged in or server issue
            console.error("Error fetching user status:", response.status);
             currentUser = null;
             // Fetch anonymous cart if not logged in
             await fetchAnonymousCart(); 
        } else {
            const data = await response.json();
            currentUser = data.user; // null if not logged in
            currentCart = data.cart; // User cart or anonymous cart
            console.log("Auth Status Response:", data);
        }
        updateAuthUI();
        displayCart(currentCart); // Display the correct cart
    } catch (error) {
        console.error("Network error fetching user status:", error);
        currentUser = null;
        currentCart = { items: [], totalQuantity: 0, totalPrice: 0 }; // Reset cart on error
        updateAuthUI();
        displayCart(currentCart);
    }
}

// Added function to specifically fetch anonymous cart if /me fails or user is null
async function fetchAnonymousCart() {
     console.log("Fetching anonymous cart...");
     try {
         const response = await fetch('/api/cart'); // This will get anon cart if not logged in
         if (response.ok) {
             currentCart = await response.json();
             console.log("Fetched anonymous cart:", currentCart);
         } else {
              console.error("Failed to fetch anonymous cart:", response.status);
              currentCart = { items: [], totalQuantity: 0, totalPrice: 0 };
         }
     } catch (error) {
         console.error("Network error fetching anonymous cart:", error);
         currentCart = { items: [], totalQuantity: 0, totalPrice: 0 };
     }
}

// --- Event Listeners ---
loginLink?.addEventListener('click', () => showModal('login-modal'));
registerLink?.addEventListener('click', () => showModal('register-modal'));

closeButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const modalId = e.target.getAttribute('data-modal-id');
        if (modalId) closeModal(modalId);
    });
});

// Close modal if clicking outside the content
window.addEventListener('click', (event) => {
  if (event.target === loginModal) closeModal('login-modal');
  if (event.target === registerModal) closeModal('register-modal');
});

loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErrorEl.style.display = 'none'; // Hide previous errors
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }
        
        currentUser = { _id: data._id, name: data.name, email: data.email };
        currentCart = data.cart; // Update cart with potentially merged data
        updateAuthUI();
        displayCart(currentCart);
        closeModal('login-modal');
        loginForm.reset();

    } catch (error) {
        console.error("Login error:", error);
        displayLoginError(error.message);
    }
});

registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerErrorEl.style.display = 'none';
    registerSuccessEl.style.display = 'none';

    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

     if (password.length < 6) {
         displayRegisterError("Password must be at least 6 characters.");
         return;
     }

    try {
         const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await response.json();
         if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        displayRegisterSuccess(data.message || 'Registration successful! Please log in.');
        registerForm.reset();
        // Maybe automatically show login modal after successful registration?
        // closeModal('register-modal');
        // showModal('login-modal');

    } catch (error) {
         console.error("Registration error:", error);
         displayRegisterError(error.message);
    }
});

logoutButton?.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Logout failed');
        }
        
        alert(data.message); // Inform user
        currentUser = null;
        // After logout, fetch the anonymous cart state
        await fetchAnonymousCart();
        updateAuthUI();
        displayCart(currentCart); 
        // Navigate home if needed (optional)
        if (window.location.pathname !== '/') {
             window.location.href = '/';
        }

    } catch (error) {
         console.error("Logout error:", error);
         alert(`Logout failed: ${error.message}`);
    }
});

// --- Initialization ---
// (initializeApp needs to call fetchCurrentUserStatus)

// function initializeApp() { ... }
async function initializeApp() {
    console.log("Initializing App...");
    await fetchCurrentUserStatus(); 

    if (document.getElementById("products-container")) { // On Shop page
        console.log("On Shop Page");
        fetchProducts(); 
    }
    if (document.getElementById('orderForm')) { // On Checkout page
        console.log("On Checkout Page");
        initializePaymentOptions(); 
        console.log("Cart state before populating summary:", JSON.stringify(currentCart, null, 2));
        updateFormSummary(currentCart); // Populate cart summary

        // --- Autofill Checkout Form --- (Add this)
        if (currentUser) {
            console.log("User logged in, attempting to autofill checkout form.");
            const nameInput = document.getElementById('customerName');
            const emailInput = document.getElementById('email');
            const phoneInput = document.getElementById('phone');
            const addressInput = document.getElementById('address');

            if (nameInput) nameInput.value = currentUser.name || '';
            if (emailInput) emailInput.value = currentUser.email || ''; // Email should always exist
            
            // Fetch full profile to get phone/address as they might not be in currentUser from /me
            try {
                const profileResponse = await fetch('/api/profile');
                if (profileResponse.ok) {
                    const profileData = await profileResponse.json();
                    console.log("Fetched profile data for autofill:", profileData);
                    if (phoneInput && profileData.phone) phoneInput.value = profileData.phone;
                    if (addressInput && profileData.address) addressInput.value = profileData.address;
                } else {
                     console.warn("Could not fetch full profile for autofill, using basic info.");
                      // Attempt to use potentially stored data if full fetch fails
                     if (phoneInput && currentUser.phone) phoneInput.value = currentUser.phone; 
                     if (addressInput && currentUser.address) addressInput.value = currentUser.address;
                }
            } catch (error) {
                 console.error("Error fetching profile for autofill:", error);
                  // Attempt to use potentially stored data on error
                 if (phoneInput && currentUser.phone) phoneInput.value = currentUser.phone; 
                 if (addressInput && currentUser.address) addressInput.value = currentUser.address;
            }
        } else {
             console.log("User not logged in, checkout form not autofilled.");
        }
        // --- End Autofill --- 
    }
}

initializeApp();