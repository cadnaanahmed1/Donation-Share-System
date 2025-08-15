// Global variables
let currentUser = null;
let currentRole = null;
let products = [];
let notifications = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    showHome();
    setupImagePreview();
    setupFormSubmission();
});

// User role management
function enterAsRecipient() {
    currentRole = 'recipient';
    currentUser = generateGuestId();
    showNavigation();
    showProducts();
    loadProducts();
}

function enterAsDonor() {
    const donorId = prompt('Enter your Donor ID (or create a new one):');
    if (donorId) {
        currentRole = 'donor';
        currentUser = donorId;
        registerUser(donorId, 'donor');
        showNavigation();
        document.getElementById('donateNav').style.display = 'block';
        document.getElementById('notificationsNav').style.display = 'block';
        showDonate();
        loadDonorProducts();
        startNotificationPolling();
    }
}

function enterAsAdmin() {
    const adminPassword = prompt('Enter admin password:');
    if (adminPassword === 'admin123') { // Simple password check
        currentRole = 'admin';
        currentUser = 'admin';
        registerUser('admin', 'admin');
        showNavigation();
        document.getElementById('adminNav').style.display = 'block';
        showAdmin();
        loadAdminProducts('pending');
    } else {
        showToast('Invalid admin password', 'error');
    }
}

// Navigation functions
function showNavigation() {
    document.getElementById('navbar').style.display = 'block';
}

function showHome() {
    hideAllPages();
    document.getElementById('homePage').classList.add('active');
}

function showProducts() {
    hideAllPages();
    document.getElementById('productsPage').classList.add('active');
}

function showDonate() {
    hideAllPages();
    document.getElementById('donatePage').classList.add('active');
}

function showAdmin() {
    hideAllPages();
    document.getElementById('adminPage').classList.add('active');
}

function showNotifications() {
    hideAllPages();
    document.getElementById('notificationsPage').classList.add('active');
    loadNotifications();
}

function hideAllPages() {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
}

// Admin tab management
function showAdminTab(tab) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    loadAdminProducts(tab);
}

// API functions
const API_BASE_URL = 'http://localhost:7000';

async function apiCall(endpoint, options = {}) {
    showLoading();
    try {
        // Haddii body waa FormData, ha dirin Content-Type
        const headers = options.body instanceof FormData ? 
                        { ...options.headers } : 
                        { 'Content-Type': 'application/json', ...options.headers };

        const response = await fetch(API_BASE_URL + endpoint, {
            ...options,
            headers
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Haddii response status 204 No Content, return null
        if (response.status === 204) return null;

        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        showToast('Error: ' + error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}



async function registerUser(userId, role) {
    try {
        await apiCall('/api/users', {
            method: 'POST',
            body: JSON.stringify({ userId, role })
        });
    } catch (error) {
        console.error('User registration failed:', error);
    }
}

// Product loading functions
async function loadProducts() {
    try {
        const data = await apiCall('/api/products?role=recipient');
        products = data;
        displayProducts(products, 'productsGrid');
    } catch (error) {
        console.error('Failed to load products:', error);
    }
}

async function loadDonorProducts() { 
    try {
        const data = await apiCall(`/api/products/donor/${currentUser}`);
        console.log('Loaded donor products:', data);
        products = data;
        displayProducts(data, 'donorProductsGrid');
    } catch (error) {
        console.error('Failed to load donor products:', error);
    }
}


async function loadAdminProducts(filter) {
    try {
        let endpoint = '/api/products/admin';

        if (filter === 'pending') endpoint += '?status=Pending';
        else if (filter === 'urgent') endpoint += '?status=Urgent';

        const data = await apiCall(endpoint);

        if (filter === 'pending') {
            displayPendingProducts(data);
        } else if (filter === 'urgent') {
            displayProducts(data, 'urgentProductsGrid', true);
        } else {
            displayProducts(data, 'adminProductsGrid', true); // All Products
        }
    } catch (error) {
        console.error('Failed to load admin products:', error);
    }
}




// Product display functions
function displayProducts(productList, containerId, isAdmin = false) {
    const container = document.getElementById(containerId);
    
    if (productList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No products found</h3>
                <p>Check back later for new items</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = productList.map(product => {
        const urgentClass = product.urgentFlag !== 'none' ? `urgent-${product.urgentFlag}` : '';
        const statusClass = `status-${product.status.toLowerCase()}`;
        
        let actionButtons = '';
        
        if (currentRole === 'recipient' && product.status === 'Available') {
            actionButtons = `<button class="btn btn-primary" onclick="requestProduct('${product._id}')">Request</button>`;
        } else if (currentRole === 'recipient' && product.status === 'Requested' && product.requesterId === currentUser) {
            actionButtons = `<button class="btn btn-primary" disabled>Requested</button>`;
        } else if (currentRole === 'donor' && (product.status === 'Pending' || product.status === 'Available')) {
            actionButtons = `<button class="btn btn-warning" onclick="editProduct('${product._id}')">Edit</button>`;
        } else if (isAdmin) {
            if (product.status === 'Pending') {
                actionButtons = `
                    <button class="btn btn-success" onclick="approveProduct('${product._id}')">Approve</button>
                    <button class="btn btn-danger" onclick="deleteProduct('${product._id}')">Delete</button>
                `;
            } else {
                actionButtons = `<button class="btn btn-danger" onclick="deleteProduct('${product._id}')">Delete</button>`;
            }
        }
        
        const urgentIndicator = product.urgentFlag !== 'none' ? 
            `<div class="urgent-indicator">${product.urgentFlag.toUpperCase()}</div>` : '';
        
        return `
            <div class="product-card ${urgentClass}" onclick="showProductDetails('${product._id}')">
                ${urgentIndicator}
                <img src="${product.productImage}" alt="${product.productName}" class="product-image">
                <div class="product-info">
                    <h3 class="product-name">${product.productName}</h3>
                    <p class="product-location">${product.city}, ${product.country}</p>
                    <span class="product-status ${statusClass}">${product.status}</span>
                    <div class="product-actions" onclick="event.stopPropagation()">
                        ${actionButtons}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Product actions
async function requestProduct(productId) {
    try {
        await apiCall(`/api/products/${productId}/request`, {
            method: 'POST',
            body: JSON.stringify({ requesterId: currentUser })
        });
        showToast('Product request sent successfully!', 'success');
        
        // Show product details including contact info after request
        const product = products.find(p => p._id === productId);
        if (product) {
            showProductDetailsWithContact(product);
        }
        
        loadProducts();
    } catch (error) {
        console.error('Failed to request product:', error);
    }
}

// async function approveProduct(productId) {
//     try {
//         await apiCall(`/api/products/${productId}/approve`, {
//             method: 'PATCH'
//         });
//         showToast('Product approved!', 'success');
//         loadAdminProducts('pending');
//     } catch (error) {
//         console.error('Failed to approve product:', error);
//     }
// }

async function approveProduct(productId) {
    try {
        await apiCall(`/api/products/${productId}/approve`, {
            method: 'PATCH'
        });
        showToast('Product approved!', 'success');
        loadAdminProducts('pending'); // refresh pending tab
        loadAdminProducts('all');     // refresh all products tab
    } catch (error) {
        console.error('Failed to approve product:', error);
    }
}


// Global variable to track if we're editing
let editingProductId = null;

async function editProduct(productId) {
    console.log('Trying to edit product with id:', productId);
    console.log('Current products:', products);
    try {
        // Find the product
        const product = products.find(p => p._id === productId);
        if (!product) {
            showToast('Product not found', 'error');
            return;
        }

        editingProductId = productId;
        
        // Fill form with existing product data
        document.getElementById('productName').value = product.productName;
        document.getElementById('contact').value = product.contact;
        document.getElementById('email').value = product.email;
        document.getElementById('country').value = product.country;
        document.getElementById('city').value = product.city;
        document.getElementById('district').value = product.district;
        document.getElementById('description').value = product.description || '';
        
        // Show current image
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img src="${product.productImage}" alt="Current image">`;
        
        // Change form title and button text
        const form = document.getElementById('donateForm');
        const submitBtn = form.querySelector('.submit-btn');
        submitBtn.textContent = 'Update Product';
        
        // Add cancel button if not exists
        if (!document.getElementById('cancelEditBtn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.id = 'cancelEditBtn';
            cancelBtn.className = 'btn btn-danger';
            cancelBtn.textContent = 'Cancel Edit';
            cancelBtn.style.marginLeft = '10px';
            cancelBtn.onclick = cancelEdit;
            submitBtn.parentNode.appendChild(cancelBtn);
        }
        
        showToast('Edit mode enabled', 'success');
        
    } catch (error) {
        console.error('Failed to load product for editing:', error);
    }
}

function cancelEdit() {
    editingProductId = null;
    
    // Reset form
    const form = document.getElementById('donateForm');
    form.reset();
    document.getElementById('imagePreview').innerHTML = '';
    
    // Reset button text
    const submitBtn = form.querySelector('.submit-btn');
    submitBtn.textContent = 'Submit Product';
    
    // Remove cancel button
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
        cancelBtn.remove();
    }
    
    showToast('Edit cancelled', 'info');
}

async function deleteProduct(productId) {
    if (confirm('Are you sure you want to delete this product?')) {
        try {
            await apiCall(`/api/products/${productId}`, {
                method: 'DELETE'
            });
            showToast('Product deleted!', 'success');
            // Stay on current page - refresh content without navigation
            if (currentRole === 'admin') {
                const activeTab = document.querySelector('.tab-btn.active').textContent.toLowerCase();
                if (activeTab.includes('pending')) {
                    loadAdminProducts('pending');
                } else if (activeTab.includes('urgent')) {
                    loadAdminProducts('urgent');
                } else {
                    loadAdminProducts('all');
                }
            } else if (currentRole === 'donor') {
                loadDonorProducts();
            }
        } catch (error) {
            console.error('Failed to delete product:', error);
        }
    }
}

// Notification functions
async function loadNotifications() {
    try {
        const data = await apiCall(`/api/notifications/${currentUser}`);
        notifications = data;
        displayNotifications(notifications);
        updateNotificationBadge();
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

function displayNotifications(notificationList) {
    const container = document.getElementById('notificationsList');
    
    if (notificationList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No notifications</h3>
                <p>You'll see product requests here</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = notificationList.map(notification => `
        <div class="notification-item ${notification.isRead ? 'read' : 'unread'}">
            <div class="notification-content">
                <h4>Product Request</h4>
                <p>${notification.message}</p>
                <small>Product: ${notification.productId?.productName || 'Unknown'}</small>
            </div>
            <div class="notification-actions">
                <button class="btn btn-success" onclick="respondToRequest('${notification._id}', 'yes')">Yes</button>
                <button class="btn btn-danger" onclick="respondToRequest('${notification._id}', 'no')">No</button>
            </div>
        </div>
    `).join('');
}

async function respondToRequest(notificationId, response) {
    try {
        await apiCall(`/api/notifications/${notificationId}/respond`, {
            method: 'POST',
            body: JSON.stringify({ response })
        });
        
        const message = response === 'yes' ? 'Request approved!' : 'Request declined!';
        showToast(message, 'success');
        
        loadNotifications();
        loadDonorProducts();
    } catch (error) {
        console.error('Failed to respond to request:', error);
    }
}

function updateNotificationBadge() {
    const badge = document.getElementById('notificationCount');
    const notificationCount = notifications.length;
    
    if (notificationCount > 0) {
        badge.textContent = notificationCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function startNotificationPolling() {
    // Poll for new notifications every 30 seconds
    setInterval(async () => {
        if (currentRole === 'donor') {
            try {
                const data = await apiCall(`/api/notifications/${currentUser}`);
                const newCount = data.length;
                const currentCount = notifications.length;
                
                if (newCount > currentCount) {
                    showToast('New product request received!', 'success');
                }
                
                notifications = data;
                updateNotificationBadge();
            } catch (error) {
                console.error('Failed to poll notifications:', error);
            }
        }
    }, 30000);
}

// Form handling
function setupImagePreview() {
    const imageInput = document.getElementById('productImage');
    const preview = document.getElementById('imagePreview');
    
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        }
    });
}

function setupFormSubmission() {
    const form = document.getElementById('donateForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData();
        const inputs = form.querySelectorAll('input, textarea');
        
        inputs.forEach(input => {
            if (input.type === 'file') {
                if (input.files[0]) {
                    formData.append(input.name, input.files[0]);
                }
            } else {
                formData.append(input.name, input.value);
            }
        });
        
        formData.append('donorId', currentUser);
        
        try {
            showLoading();
            let response;
            let successMessage;
            
            if (editingProductId) {
                // Update existing product
                response = await fetch(`/api/products/${editingProductId}`, {
                    method: 'PUT',
                    body: formData
                });
                successMessage = 'Product updated successfully!';
            } else {
                // Create new product
                response = await fetch('/api/products', {
                    method: 'POST',
                    body: formData
                });
                successMessage = 'Product submitted for review!';
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            await response.json();
            showToast(successMessage, 'success');
            
            // Reset form and edit state
            form.reset();
            document.getElementById('imagePreview').innerHTML = '';
            
            if (editingProductId) {
                cancelEdit();
            }
            
            loadDonorProducts();
        } catch (error) {
            console.error('Failed to submit product:', error);
            showToast('Failed to submit product: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    });
}

// Search functionality
function filterProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filteredProducts = products.filter(product =>
        product.productName.toLowerCase().includes(searchTerm) ||
        product.city.toLowerCase().includes(searchTerm) ||
        product.country.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm)
    );
    displayProducts(filteredProducts, 'productsGrid');
}

// Modal functions
function showProductDetails(productId) {
    const product = products.find(p => p._id === productId) || 
                   notifications.find(n => n.productId?._id === productId)?.productId;
    
    if (!product) return;
    
    const modal = document.getElementById('productModal');
    const modalContent = document.getElementById('modalContent');
    
    // Hide contact info unless user has requested this product or is donor/admin
    const showContactInfo = currentRole === 'admin' || 
                           currentRole === 'donor' || 
                           (currentRole === 'recipient' && product.status === 'Requested' && product.requesterId === currentUser);
    
    modalContent.innerHTML = `
        <h2>${product.productName}</h2>
        <img src="${product.productImage}" alt="${product.productName}" style="width: 100%; max-width: 400px; margin: 1rem 0;">
        <p><strong>Location:</strong> ${product.district}, ${product.city}, ${product.country}</p>
        ${showContactInfo ? `
            <p><strong>Contact:</strong> ${product.contact}</p>
            <p><strong>Email:</strong> ${product.email}</p>
        ` : '<p><em>Contact details will be revealed after making a request</em></p>'}
        <p><strong>Status:</strong> <span class="product-status status-${product.status.toLowerCase()}">${product.status}</span></p>
        ${product.description ? `<p><strong>Description:</strong> ${product.description}</p>` : ''}
        <p><strong>Posted:</strong> ${new Date(product.createdAt).toLocaleDateString()}</p>
    `;
    
    modal.style.display = 'block';
}

function showProductDetailsWithContact(product) {
    const modal = document.getElementById('productModal');
    const modalContent = document.getElementById('modalContent');
    
    modalContent.innerHTML = `
        <h2>${product.productName}</h2>
        <img src="${product.productImage}" alt="${product.productName}" style="width: 100%; max-width: 400px; margin: 1rem 0;">
        <p><strong>Location:</strong> ${product.district}, ${product.city}, ${product.country}</p>
        <p><strong>Contact:</strong> ${product.contact}</p>
        <p><strong>Email:</strong> ${product.email}</p>
        <p><strong>Status:</strong> <span class="product-status status-${product.status.toLowerCase()}">${product.status}</span></p>
        ${product.description ? `<p><strong>Description:</strong> ${product.description}</p>` : ''}
        <p><strong>Posted:</strong> ${new Date(product.createdAt).toLocaleDateString()}</p>
        <div style="margin-top: 1rem; padding: 1rem; background-color: #e8f5e8; border-radius: 8px; border-left: 4px solid #28a745;">
            <strong>✓ Request Sent!</strong><br>
            Contact details are now visible. You can reach the donor using the information above.
        </div>
    `;
    
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('productModal').style.display = 'none';
}

// Utility functions
function generateGuestId() {
    return 'guest_' + Math.random().toString(36).substr(2, 9);
}

function showLoading() {
    document.getElementById('loadingSpinner').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('productModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Handle escape key for modal
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

function updateNotificationBadge() {
    const badge = document.getElementById('notificationCount');
    const notificationCount = notifications.length;
    
    if (notificationCount > 0) {
        badge.textContent = notificationCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function startNotificationPolling() {
    // Poll for new notifications every 30 seconds
    setInterval(async () => {
        if (currentRole === 'donor') {
            try {
                const data = await apiCall(`/api/notifications/${currentUser}`);
                const newCount = data.length;
                const currentCount = notifications.length;
                
                if (newCount > currentCount) {
                    showToast('New product request received!', 'success');
                }
                
                notifications = data;
                updateNotificationBadge();
            } catch (error) {
                console.error('Failed to poll notifications:', error);
            }
        }
    }, 30000);
}

// Form handling
function setupImagePreview() {
    const imageInput = document.getElementById('productImage');
    const preview = document.getElementById('imagePreview');
    
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        }
    });
}

function setupFormSubmission() {
    const form = document.getElementById('donateForm');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const formData = new FormData();
        const inputs = form.querySelectorAll('input, textarea');

        inputs.forEach(input => {
            if (input.type === 'file') {
                if (input.files[0]) {
                    formData.append(input.name, input.files[0]);
                }
            } else {
                formData.append(input.name, input.value);
            }
        });

        formData.append('donorId', currentUser);

        try {
            showLoading();
            let response;
            let successMessage;

            if (editingProductId) {
                // Update existing product
                response = await fetch(`${API_BASE_URL}/api/products/${editingProductId}`, {
                    method: 'PUT',
                    body: formData
                });
                successMessage = 'Product updated successfully!';
            } else {
                // Create new product
                response = await fetch(`${API_BASE_URL}/api/products`, {
                    method: 'POST',
                    body: formData
                });
                successMessage = 'Product submitted for review!';
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            await response.json();
            showToast(successMessage, 'success');

            // Reset form and edit state
            form.reset();
            document.getElementById('imagePreview').innerHTML = '';

            if (editingProductId) {
                cancelEdit();
            }

            loadDonorProducts();
        } catch (error) {
            console.error('Failed to submit product:', error);
            showToast('Failed to submit product: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    });
}


// Search functionality
function filterProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filteredProducts = products.filter(product =>
        product.productName.toLowerCase().includes(searchTerm) ||
        product.city.toLowerCase().includes(searchTerm) ||
        product.country.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm)
    );
    displayProducts(filteredProducts, 'productsGrid');
}

// Modal functions
function showProductDetails(productId) {
    const product = products.find(p => p._id === productId) || 
                   notifications.find(n => n.productId?._id === productId)?.productId;
    
    if (!product) return;
    
    const modal = document.getElementById('productModal');
    const modalContent = document.getElementById('modalContent');
    
    // Hide contact info unless user has requested this product or is donor/admin
    const showContactInfo = currentRole === 'admin' || 
                           currentRole === 'donor' || 
                           (currentRole === 'recipient' && product.status === 'Requested' && product.requesterId === currentUser);
    
    modalContent.innerHTML = `
        <h2>${product.productName}</h2>
        <img src="${product.productImage}" alt="${product.productName}" style="width: 100%; max-width: 400px; margin: 1rem 0;">
        <p><strong>Location:</strong> ${product.district}, ${product.city}, ${product.country}</p>
        ${showContactInfo ? `
            <p><strong>Contact:</strong> ${product.contact}</p>
            <p><strong>Email:</strong> ${product.email}</p>
        ` : '<p><em>Contact details will be revealed after making a request</em></p>'}
        <p><strong>Status:</strong> <span class="product-status status-${product.status.toLowerCase()}">${product.status}</span></p>
        ${product.description ? `<p><strong>Description:</strong> ${product.description}</p>` : ''}
        <p><strong>Posted:</strong> ${new Date(product.createdAt).toLocaleDateString()}</p>
    `;
    
    modal.style.display = 'block';
}

function showProductDetailsWithContact(product) {
    const modal = document.getElementById('productModal');
    const modalContent = document.getElementById('modalContent');
    
    modalContent.innerHTML = `
        <h2>${product.productName}</h2>
        <img src="${product.productImage}" alt="${product.productName}" style="width: 100%; max-width: 400px; margin: 1rem 0;">
        <p><strong>Location:</strong> ${product.district}, ${product.city}, ${product.country}</p>
        <p><strong>Contact:</strong> ${product.contact}</p>
        <p><strong>Email:</strong> ${product.email}</p>
        <p><strong>Status:</strong> <span class="product-status status-${product.status.toLowerCase()}">${product.status}</span></p>
        ${product.description ? `<p><strong>Description:</strong> ${product.description}</p>` : ''}
        <p><strong>Posted:</strong> ${new Date(product.createdAt).toLocaleDateString()}</p>
        <div style="margin-top: 1rem; padding: 1rem; background-color: #e8f5e8; border-radius: 8px; border-left: 4px solid #28a745;">
            <strong>✓ Request Sent!</strong><br>
            Contact details are now visible. You can reach the donor using the information above.
        </div>
    `;
    
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('productModal').style.display = 'none';
}

// Utility functions
function generateGuestId() {
    return 'guest_' + Math.random().toString(36).substr(2, 9);
}

function showLoading() {
    document.getElementById('loadingSpinner').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingSpinner').style.display = 'none';
}


//////////////
function displayPendingProducts(products) {
    const container = document.getElementById('adminProductsGrid');
    if (!products.length) {
        container.innerHTML = '<p>No pending products found.</p>';
        return;
    }

    container.innerHTML = products.map(product => `
        <div class="product-card">
            <img src="${product.productImage}" alt="${product.productName}" class="product-image" />
            <h3>${product.productName}</h3>
            <p><strong>Location:</strong> ${product.district}, ${product.city}, ${product.country}</p>
            <p><strong>Contact:</strong> ${product.contact}</p>
            <p><strong>Email:</strong> ${product.email}</p>
            <p><strong>Description:</strong> ${product.description || 'No description provided'}</p>
            <p><strong>Status:</strong> <span class="status pending">${product.status}</span></p>
            <button onclick="approveProduct('${product._id}')">Approve</button>
            <button onclick="deleteProduct('${product._id}')">Delete</button>
        </div>
    `).join('');
}

////////////////////////////////////////////// rejects delete

async function hideRejectedProduct(productId) {
    try {
        const response = await fetch(`/api/products/${productId}/hide-from-admin`, {
            method: 'PUT'
        });
        if (!response.ok) throw new Error('Failed to hide product');
        showToast('Rejected product hidden from admin profile', 'success');
        // Reload admin products list here
        loadAdminProducts('pending'); // ama sida aad ugu baahantahay
    } catch (error) {
        showToast(error.message, 'error');
    }
}


////////////////////////

document.getElementById('deleteRejectedBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to hide all rejected products from admin profile?')) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/products/hide-rejected`, {
                method: 'PUT'
            });
            if (!response.ok) throw new Error('Failed to hide rejected products');
            alert('Rejected products hidden successfully.');
            loadAdminProducts('pending'); // ama sidaad u rabto inaad dib u cusboonaysiiso liiska
        } catch (error) {
            alert(error.message);
        }
    }
});








//////////////////////////////////////////rejected delete ends


function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('productModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Handle escape key for modal
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});


// ------------------------------------------------------------
// Hamburger toggle
const menuToggle = document.getElementById("menuToggle");
const navMenu = document.querySelector("nav ul");

menuToggle.addEventListener("click", function() {
    navMenu.classList.toggle("show");
});

// Close menu when a link is clicked (mobile)
navMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
        if(window.innerWidth <= 768) {
            navMenu.classList.remove("show");
        }
    });
});

// Scroll logic: hide on scroll down, show on scroll up
let prevScrollPos = window.pageYOffset;
const navbar = document.getElementById("navbarAdvanced");

window.addEventListener("scroll", () => {
    let currentScrollPos = window.pageYOffset;

    // Show / hide navbar
    if (prevScrollPos > currentScrollPos) {
        navbar.style.top = "0";
    } else {
        navbar.style.top = "-80px";
    }

    // Add class when scrolled for shadow / background effect
    if(currentScrollPos > 10) {
        navbar.classList.add("scrolled");
    } else {
        navbar.classList.remove("scrolled");
    }

    prevScrollPos = currentScrollPos;
});