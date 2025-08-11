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
async function apiCall(endpoint, options = {}) {
    showLoading();
    try {
        const response = await fetch(endpoint, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
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
        displayProducts(data, 'donorProductsGrid');
    } catch (error) {
        console.error('Failed to load donor products:', error);
    }
}

async function loadAdminProducts(filter) {
    try {
        let endpoint = '/api/products';
        if (filter === 'pending') {
            endpoint += '?status=Pending';
        } else if (filter === 'urgent') {
            const data = await apiCall('/api/products');
            const urgentProducts = data.filter(p => p.urgentFlag !== 'none');
            displayProducts(urgentProducts, 'adminProductsGrid', true);
            return;
        }
        
        const data = await apiCall(endpoint);
        displayProducts(data, 'adminProductsGrid', true);
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
        loadProducts();
    } catch (error) {
        console.error('Failed to request product:', error);
    }
}

async function approveProduct(productId) {
    try {
        await apiCall(`/api/products/${productId}/approve`, {
            method: 'PATCH'
        });
        showToast('Product approved!', 'success');
        loadAdminProducts('pending');
    } catch (error) {
        console.error('Failed to approve product:', error);
    }
}

async function deleteProduct(productId) {
    if (confirm('Are you sure you want to delete this product?')) {
        try {
            await apiCall(`/api/products/${productId}`, {
                method: 'DELETE'
            });
            showToast('Product deleted!', 'success');
            if (currentRole === 'admin') {
                loadAdminProducts('all');
            } else {
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
    const unreadCount = notifications.filter(n => !n.isRead).length;
    
    if (unreadCount > 0) {
        badge.textContent = unreadCount;
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
                const unreadCount = data.filter(n => !n.isRead).length;
                const currentUnreadCount = notifications.filter(n => !n.isRead).length;
                
                if (unreadCount > currentUnreadCount) {
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
            const response = await fetch('/api/products', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            await response.json();
            showToast('Product submitted for review!', 'success');
            form.reset();
            document.getElementById('imagePreview').innerHTML = '';
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
    
    modalContent.innerHTML = `
        <h2>${product.productName}</h2>
        <img src="${product.productImage}" alt="${product.productName}" style="width: 100%; max-width: 400px; margin: 1rem 0;">
        <p><strong>Location:</strong> ${product.district}, ${product.city}, ${product.country}</p>
        <p><strong>Contact:</strong> ${product.contact}</p>
        <p><strong>Email:</strong> ${product.email}</p>
        <p><strong>Status:</strong> <span class="product-status status-${product.status.toLowerCase()}">${product.status}</span></p>
        ${product.description ? `<p><strong>Description:</strong> ${product.description}</p>` : ''}
        <p><strong>Posted:</strong> ${new Date(product.createdAt).toLocaleDateString()}</p>
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