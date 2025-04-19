document.addEventListener('DOMContentLoaded', () => {
    const productsSection = document.getElementById('products-section');
    const ordersSection = document.getElementById('orders-section');
    const usersSection = document.getElementById('users-section');
    const navProducts = document.getElementById('nav-products');
    const navOrders = document.getElementById('nav-orders');
    const navUsers = document.getElementById('nav-users');

    const productsList = document.getElementById('products-list');
    const ordersList = document.getElementById('orders-list');
    const usersList = document.getElementById('users-list');
    
    const productForm = document.getElementById('product-form');
    const showAddProductFormButton = document.getElementById('show-add-product-form');
    const cancelEditProductButton = document.getElementById('cancel-edit-product');

    const orderDetailsModal = document.getElementById('order-details-modal');
    const orderDetailsContent = document.getElementById('order-details-content');
    const closeOrderModalButton = document.getElementById('close-order-modal');

    const apiKeyInput = document.getElementById('admin-api-key');
    const saveApiKeyButton = document.getElementById('save-api-key');
    const apiKeyStatus = document.getElementById('api-key-status');

    // Reverted Filter/Export elements
    const filterDateInput = document.getElementById('filter-date'); 
    const applyFiltersButton = document.getElementById('apply-filters'); // Now the 'Filter' button
    const clearFiltersButton = document.getElementById('clear-filters'); // Now the 'Show All' button
    const exportOrdersButton = document.getElementById('export-orders-button'); // Export button
    // Remove references to filterTypeSelect, filterValueInput, exportButton (<a> link)

    const ordersLoading = document.getElementById('orders-loading'); // Keep if used elsewhere, or reference table directly
    const ordersTableBody = document.querySelector('#orders-table tbody');

    let currentApiKey = localStorage.getItem('adminApiKey') || '';
    apiKeyInput.value = currentApiKey;
    updateApiKeyStatus();

    // --- API Key Handling ---
    saveApiKeyButton.addEventListener('click', () => {
        currentApiKey = apiKeyInput.value.trim();
        if (currentApiKey) {
            localStorage.setItem('adminApiKey', currentApiKey);
            apiKeyStatus.textContent = 'Key saved (in localStorage).';
            apiKeyStatus.style.color = 'green';
            // Optionally re-fetch data after saving key
            if (productsSection.style.display !== 'none') fetchProducts();
            if (ordersSection.style.display !== 'none') fetchOrders();
        } else {
            localStorage.removeItem('adminApiKey');
            apiKeyStatus.textContent = 'Key removed.';
            apiKeyStatus.style.color = 'orange';
        }
    });

    function updateApiKeyStatus() {
         if (currentApiKey) {
            apiKeyStatus.textContent = 'Key loaded from localStorage.';
            apiKeyStatus.style.color = 'blue';
        } else {
            apiKeyStatus.textContent = 'No API Key entered.';
            apiKeyStatus.style.color = 'red';
        }
    }

    function getAuthHeaders() {
        if (!currentApiKey) {
            alert('Admin API Key is required!');
            return null;
        }
        return {
            'Content-Type': 'application/json',
            'x-admin-api-key': currentApiKey
        };
    }

    // --- Navigation ---
    navProducts.addEventListener('click', () => {
        productsSection.style.display = 'block';
        ordersSection.style.display = 'none';
        usersSection.style.display = 'none';
        fetchProducts();
        hideProductForm();
    });

    navOrders.addEventListener('click', () => {
        productsSection.style.display = 'none';
        ordersSection.style.display = 'block';
        usersSection.style.display = 'none';
        if(filterDateInput) filterDateInput.value = ''; // Reset filter on tab switch
        fetchOrders(); // Fetch all initially
        hideOrderDetails();
    });
    
    navUsers.addEventListener('click', () => {
        productsSection.style.display = 'none';
        ordersSection.style.display = 'none';
        usersSection.style.display = 'block';
        fetchUsers(); 
    });

    // --- Product Management ---
    async function fetchProducts() {
        const headers = getAuthHeaders();
        if (!headers) return;

        try {
            const response = await fetch('/api/admin/products', { headers });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
            }
            const products = await response.json();
            displayProducts(products);
        } catch (error) {
            console.error('Error fetching products:', error);
            productsList.innerHTML = `<tr><td colspan="4" style="color: red;">Error loading products: ${error.message} (Ensure API Key is correct)</td></tr>`;
        }
    }

    function displayProducts(products) {
        productsList.innerHTML = ''; // Clear list
        if (!products || products.length === 0) {
             productsList.innerHTML = '<tr><td colspan="4">No products found.</td></tr>';
             return;
        }
        products.forEach(product => {
            const row = productsList.insertRow();
            row.innerHTML = `
                <td><img src="${product.image}" alt="${product.name}" width="50"></td>
                <td>${product.name}</td>
                <td>$${product.price.toFixed(2)}</td>
                <td>
                    <button class="btn btn-edit" data-id="${product._id}">Edit</button>
                    <button class="btn btn-delete" data-id="${product._id}">Delete</button>
                </td>
            `;
        });
    }

    showAddProductFormButton.addEventListener('click', () => {
        productForm.reset();
        document.getElementById('product-id').value = ''; // Clear hidden ID
        productForm.querySelector('h3').textContent = 'Add New Product';
        productForm.style.display = 'block';
    });

    cancelEditProductButton.addEventListener('click', hideProductForm);

    function hideProductForm() {
        productForm.style.display = 'none';
        productForm.reset();
    }

    productForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const headers = getAuthHeaders();
        if (!headers) return;

        const productId = document.getElementById('product-id').value;
        const productData = {
            name: document.getElementById('product-name').value,
            description: document.getElementById('product-description').value,
            price: parseFloat(document.getElementById('product-price').value),
            image: document.getElementById('product-image').value
        };

        const url = productId ? `/api/admin/products/${productId}` : '/api/admin/products';
        const method = productId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: headers,
                body: JSON.stringify(productData)
            });
             if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
            }
            alert(`Product ${productId ? 'updated' : 'created'} successfully!`);
            hideProductForm();
            fetchProducts(); // Refresh list
        } catch (error) {
            console.error(`Error saving product:`, error);
            alert(`Error saving product: ${error.message}`);
        }
    });

    productsList.addEventListener('click', async (event) => {
        const target = event.target;
        const productId = target.dataset.id;

        if (target.classList.contains('btn-edit')) {
            // Fetch product details to populate form (or use data if stored locally)
             const headers = getAuthHeaders();
             if (!headers) return;
             try {
                 // Ideally, fetch the specific product, but for simplicity, find from current list
                 const response = await fetch('/api/admin/products', { headers }); 
                 const products = await response.json();
                 const product = products.find(p => p._id === productId);
                 if (product) {
                     populateProductForm(product);
                 }
             } catch (error) {
                 console.error('Error fetching product for edit:', error);
                 alert('Could not load product details for editing.');
             }
        } else if (target.classList.contains('btn-delete')) {
            if (confirm('Are you sure you want to delete this product?')) {
                deleteProduct(productId);
            }
        }
    });

    function populateProductForm(product) {
        document.getElementById('product-id').value = product._id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-description').value = product.description;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-image').value = product.image;
        productForm.querySelector('h3').textContent = 'Edit Product';
        productForm.style.display = 'block';
    }

    async function deleteProduct(productId) {
        const headers = getAuthHeaders();
        if (!headers) return;

        try {
            const response = await fetch(`/api/admin/products/${productId}`, {
                method: 'DELETE',
                headers: headers
            });
             if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
            }
            alert('Product deleted successfully!');
            fetchProducts(); // Refresh list
        } catch (error) {
            console.error('Error deleting product:', error);
            alert(`Error deleting product: ${error.message}`);
        }
    }

    // --- Order Management --- (Reverted fetchOrders)
    async function fetchOrders(filterDate = null) { // Accept optional date filter
        ordersLoading.style.display = 'block';
        ordersList.innerHTML = ''; // Use ordersList
        exportOrdersButton.style.display = 'none'; // Hide export button initially

        const params = new URLSearchParams();
        if (filterDate) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(filterDate)) {
                alert('Invalid date format. Please use YYYY-MM-DD.');
                ordersLoading.style.display = 'none';
                ordersList.innerHTML = '<tr><td colspan="6">Invalid date format for filtering.</td></tr>'; // Use ordersList
                return; // Stop fetching
            }
            params.append('date', filterDate);
        }

        const queryString = params.toString();
        const fetchUrl = `/api/admin/orders?${queryString}`;

        console.log("Fetching orders from:", fetchUrl);

        try {
            const response = await fetch(fetchUrl, {
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
            }
            const orders = await response.json();
            
            ordersLoading.style.display = 'none'; // Hide loading indicator
            displayOrders(orders);
            
            // Show export button if there are orders
            exportOrdersButton.style.display = orders.length > 0 ? 'inline-block' : 'none'; 

        } catch (error) {
            console.error('Error fetching orders:', error);
            ordersLoading.style.display = 'none';
            ordersList.innerHTML = `<tr><td colspan="6" style="color: red;">Error loading orders: ${error.message}</td></tr>`; // Use ordersList
        } 
        // Remove finally block if ordersLoading handled above
    }

    // --- Display Orders --- (No changes needed from previous state)
    function displayOrders(orders) {
        ordersList.innerHTML = ''; // Clear list (using ordersList)
        if (!orders || orders.length === 0) {
             ordersList.innerHTML = '<tr><td colspan="6">No orders found.</td></tr>'; // Use ordersList
             return;
        }
        orders.forEach(order => {
            const row = ordersList.insertRow();
            const orderDate = new Date(order.orderDate).toLocaleDateString();
            row.innerHTML = `
                <td>${order._id}</td>
                <td>${orderDate}</td>
                <td>${order.customerName} (${order.email})</td>
                <td>$${order.totalAmount.toFixed(2)}</td>
                <td>
                    <select class="order-status-select" data-id="${order._id}">
                        <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
                        <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                    <button class="btn btn-update-status" data-id="${order._id}">Update</button>
                </td>
                <td>
                    <button class="btn btn-view" data-id="${order._id}">View Details</button>
                </td>
            `;
        });
    }

     ordersList.addEventListener('click', async (event) => {
        const target = event.target;
        const orderId = target.dataset.id;

        if (target.classList.contains('btn-view')) {
            fetchOrderDetails(orderId);
        } else if (target.classList.contains('btn-update-status')) {
            const selectElement = target.closest('td').querySelector('.order-status-select');
            const newStatus = selectElement.value;
            updateOrderStatus(orderId, newStatus);
        }
    });

    async function fetchOrderDetails(orderId) {
        const headers = getAuthHeaders();
        if (!headers) return;
        try {
            const response = await fetch(`/api/admin/orders/${orderId}`, { headers });
             if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
            }
            const orderDetails = await response.json();
            orderDetailsContent.textContent = JSON.stringify(orderDetails, null, 2); // Pretty print JSON
            orderDetailsModal.style.display = 'block';
        } catch (error) {
            console.error('Error fetching order details:', error);
            alert(`Error fetching order details: ${error.message}`);
        }
    }

    async function updateOrderStatus(orderId, status) {
        const headers = getAuthHeaders();
        if (!headers) return;
        try {
            const response = await fetch(`/api/admin/orders/${orderId}/status`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({ status: status })
            });
             if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
            }
            alert('Order status updated successfully!');
            // Optionally refresh just the status or refetch all orders
            fetchOrders(); 
        } catch (error) {
             console.error('Error updating order status:', error);
            alert(`Error updating order status: ${error.message}`);
        }
    }

    closeOrderModalButton.addEventListener('click', hideOrderDetails);

    function hideOrderDetails() {
         orderDetailsModal.style.display = 'none';
         orderDetailsContent.textContent = '';
    }

    // --- User Management ---
    async function fetchUsers() {
        const headers = getAuthHeaders();
        if (!headers) return;

        try {
            const response = await fetch('/api/admin/users', { headers });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
            }
            const users = await response.json();
            displayUsers(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            usersList.innerHTML = `<tr><td colspan="4" style="color: red;">Error loading users: ${error.message} (Ensure API Key is correct)</td></tr>`;
        }
    }

    function displayUsers(users) {
        usersList.innerHTML = ''; // Clear list
        if (!users || users.length === 0) {
            usersList.innerHTML = '<tr><td colspan="4">No users found.</td></tr>';
            return;
        }
        users.forEach(user => {
            const row = usersList.insertRow();
            const registeredDate = new Date(user.createdAt).toLocaleDateString();
            row.innerHTML = `
                <td>${user._id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${registeredDate}</td>
            `; 
        });
    }

    // --- Event Listeners --- (Reverted)
    
    // Filter button listener
    applyFiltersButton.addEventListener('click', () => {
        const selectedDate = filterDateInput.value;
        fetchOrders(selectedDate); // Pass date value or null/undefined
    });
    
    // Show All button listener
    clearFiltersButton.addEventListener('click', () => {
        filterDateInput.value = ''; // Clear the date input
        fetchOrders(); // Fetch all orders
    });

    // Add listener for Enter key in the date filter input
    filterDateInput?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            fetchOrders(filterDateInput.value); // Trigger filter on Enter key
        }
    });

    // Export button listener (Replaces direct link functionality)
    exportOrdersButton.addEventListener('click', async () => {
        const selectedDate = filterDateInput.value;
        let exportUrl = '/api/admin/orders/export';
        let fileNameDate = 'all-dates'; // Default filename part

        if (selectedDate) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
                exportUrl += `?date=${selectedDate}`;
                fileNameDate = selectedDate; // Use selected date in filename
                console.log(`Preparing export for date: ${selectedDate}`);
            } else {
                 console.warn("Invalid date format selected for export, exporting all.");
                 // Optionally alert user or just export all
            }            
        } else {
            console.log('Preparing export for all dates.');
        }

        const headers = getAuthHeaders();
        if (!headers) {
            alert('Cannot export without a valid Admin API Key.');
            return;
        }

        try {
            console.log(`Fetching export from: ${exportUrl}`);
            const response = await fetch(exportUrl, { 
                method: 'GET', 
                headers: headers // Include the auth header!
            });

            if (!response.ok) {
                // Try to get error message from response if possible
                let errorMsg = `Export failed with status: ${response.status}`;
                try {
                    if (response.headers.get("content-type")?.includes("application/json")) {
                        const errorData = await response.json();
                        errorMsg = errorData.message || errorMsg;
                    } else {
                        const errorText = await response.text(); 
                        errorMsg = errorText || errorMsg;
                    }
                } catch (e) { /* Ignore parsing errors, stick to status */ }
                throw new Error(errorMsg);
            }

            const csvData = await response.text();
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `orders-${fileNameDate}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            console.log("Export triggered successfully.");

        } catch (error) {
            console.error('Error exporting orders:', error);
            alert(`Error exporting orders: ${error.message}`);
        }
    });


    // Delegate event listener for status change/view buttons (No changes needed)
    // --- Initial Load --- 
    // fetchProducts(); // Load products by default (if needed)
    fetchOrders(); // Load orders by default
});
