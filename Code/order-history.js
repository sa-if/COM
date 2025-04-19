document.addEventListener('DOMContentLoaded', () => {
    const ordersContainer = document.getElementById('orders-container');
    const loadingMessage = document.getElementById('loading-message');
    const ordersError = document.getElementById('orders-error');

    // Function to display error messages
    function showError(message) {
        if (ordersError) {
            ordersError.textContent = message;
            ordersError.style.display = 'block';
        }
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
        if (ordersContainer) {
            ordersContainer.innerHTML = ''; // Clear any partial content
        }
    }

    // Function to format date
    function formatDate(dateString) {
        try {
            const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            return new Date(dateString).toLocaleDateString(undefined, options);
        } catch (e) {
            return dateString; // Return original if formatting fails
        }
    }

    // Function to toggle order details visibility
    function toggleOrderDetails(event) {
        // Find the parent .order-item element
        const orderItemElement = event.target.closest('.order-item');
        if (!orderItemElement) return;

        // Find the .order-details element within this order item
        const detailsElement = orderItemElement.querySelector('.order-details');
        if (detailsElement) {
            detailsElement.classList.toggle('visible');
        }
    }

    // Function to display orders
    function displayOrders(orders) {
        if (loadingMessage) loadingMessage.style.display = 'none';
        if (!ordersContainer) return;

        ordersContainer.innerHTML = ''; // Clear loading message

        if (orders.length === 0) {
            ordersContainer.innerHTML = '<p>You have no past orders.</p>';
            return;
        }

        orders.forEach(order => {
            const orderElement = document.createElement('div');
            orderElement.classList.add('order-item');
            // Add data attribute for potential future use
            orderElement.dataset.orderId = order._id;

            // Convert status to lowercase for CSS class matching
            const statusClass = order.status ? order.status.toLowerCase() : 'pending';

            // Order Summary (Clickable part)
            const summary = document.createElement('div');
            summary.classList.add('order-summary');
            summary.innerHTML = `
                <span>Order ID: ${order._id}</span>
                <span>Date: ${formatDate(order.orderDate)}</span>
                <span>Total: $${order.totalAmount.toFixed(2)}</span>
                <span class="order-status ${statusClass}">${order.status || 'Pending'}</span>
            `;

            // Order Details (Initially hidden)
            const details = document.createElement('div');
            details.classList.add('order-details'); // Initially hidden by CSS
            
            let itemsHtml = '<ul>';
            order.items.forEach(item => {
                itemsHtml += `<li>${item.name} x ${item.quantity} (@ $${item.price.toFixed(2)} each)</li>`;
            });
            itemsHtml += '</ul>';

            details.innerHTML = `
                <h4>Order Details</h4>
                <p><strong>Shipping Address:</strong> ${order.address}</p>
                <p><strong>Contact:</strong> ${order.email} / ${order.phone}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                ${order.paymentMethod === 'Bkash' ? `<p><strong>Bkash Number:</strong> ${order.paymentNumber || 'N/A'}</p><p><strong>Transaction ID:</strong> ${order.transactionId || 'N/A'}</p>` : ''}
                <h4>Items Ordered</h4>
                ${itemsHtml}
            `;

            orderElement.appendChild(summary);
            orderElement.appendChild(details);

            // Add click listener to the whole order item to toggle details
            orderElement.addEventListener('click', toggleOrderDetails);

            ordersContainer.appendChild(orderElement);
        });
    }

    // Fetch orders on load
    async function fetchOrders() {
        console.log("Fetching user orders...");
        try {
            // This endpoint is protected, requires login
            const response = await fetch('/api/orders/my'); 
            
            if (response.status === 401) {
                // If unauthorized, redirect to login (or show message)
                 showError('Please log in to view your order history.');
                // Optional: Redirect after a delay
                // setTimeout(() => { window.location.href = '/'; }, 2000);
                return; 
            }
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to fetch orders');
            }
            
            const orders = await response.json();
            console.log("Orders received:", orders);
            displayOrders(orders);

        } catch (error) {
            console.error("Error fetching orders:", error);
            showError(`Error loading orders: ${error.message}`);
        }
    }

    // Initial fetch
    fetchOrders();
}); 