// YOUR LIVE SUPABASE KEYS
const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";

let db;
let allProducts = [];
let cart = {}; // Object format: { productId: { product, qty } }

// Sub-Categories Map for Daily Needs
const dailyNeedsSubMap = [
    { name: 'All Daily', icon: '🧺', value: 'ALL' },
    { name: 'Grocery', icon: '🌾', value: 'Maize Meal' },
    { name: 'Household Essentials', icon: '🧹', value: 'Dishwashing Soap' },
    { name: 'Personal Care', icon: '🧴', value: 'Personal Care' },
    { name: 'Baby Care', icon: '🍼', value: 'Baby Care' }
];

window.onload = function() {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    loadBanners();
    loadProducts();
};

async function loadBanners() {
    const { data: banners } = await db.from('banners').select('*').eq('is_active', true);
    if (!banners || banners.length === 0) return;

    const container = document.getElementById("banner-carousel");
    if (container) {
        container.innerHTML = banners.map(b => `
            <div class="banner-card" style="background-image: url('${b.image_url}');">
                <div class="banner-overlay">
                    <h4>${b.title || ''}</h4>
                    <p>${b.subtitle || ''}</p>
                </div>
            </div>
        `).join('');
    }
}

async function loadProducts() {
    const { data: products, error } = await db.from('products').select('*');
    if (error || !products) {
        document.getElementById("product-list").innerText = "Failed to load products.";
        return;
    }

    allProducts = products;
    populateFilterDropdowns();
    renderProducts(allProducts);
}

function populateFilterDropdowns() {
    const categories = ['ALL', ...new Set(allProducts.map(p => p.category).filter(Boolean))];
    const categorySelect = document.getElementById("filter-category");
    if (categorySelect) {
        categorySelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    handleCategoryChange();
}

function handleCategoryChange() {
    const categorySelect = document.getElementById("filter-category");
    const selectedCategory = categorySelect ? categorySelect.value : 'ALL';

    const filteredForSub = selectedCategory === 'ALL' 
        ? allProducts 
        : allProducts.filter(p => p.category === selectedCategory);

    const subcategories = ['ALL', ...new Set(filteredForSub.map(p => p.sub_category).filter(Boolean))];
    const subSelect = document.getElementById("filter-subcategory");
    if (subSelect) {
        subSelect.innerHTML = subcategories.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    const brands = ['ALL', ...new Set(filteredForSub.map(p => p.brand).filter(Boolean))];
    const brandSelect = document.getElementById("filter-brand");
    if (brandSelect) {
        brandSelect.innerHTML = brands.map(b => `<option value="${b}">${b}</option>`).join('');
    }

    applyFilters();
}

// UNIVERSAL FILTER + SEARCH ENGINE
function applyFilters() {
    const cat = document.getElementById("filter-category")?.value || 'ALL';
    const sub = document.getElementById("filter-subcategory")?.value || 'ALL';
    const brand = document.getElementById("filter-brand")?.value || 'ALL';
    const searchQuery = (document.getElementById("search-input")?.value || "").toLowerCase().trim();

    let filtered = allProducts;

    // Apply Dropdown Filters
    if (cat !== 'ALL') filtered = filtered.filter(p => p.category === cat);
    if (sub !== 'ALL') filtered = filtered.filter(p => p.sub_category === sub);
    if (brand !== 'ALL') filtered = filtered.filter(p => p.brand === brand);

    // Apply Multi-Field Text Search
    if (searchQuery !== "") {
        filtered = filtered.filter(p => 
            (p.name && p.name.toLowerCase().includes(searchQuery)) ||
            (p.category && p.category.toLowerCase().includes(searchQuery)) ||
            (p.sub_category && p.sub_category.toLowerCase().includes(searchQuery)) ||
            (p.brand && p.brand.toLowerCase().includes(searchQuery)) ||
            (p.description && p.description.toLowerCase().includes(searchQuery))
        );
    }

    renderProducts(filtered);
}

function renderProducts(products) {
    const container = document.getElementById("product-list");
    if (products.length === 0) {
        container.innerHTML = "<p><small>No items match your search or filter.</small></p>";
        return;
    }

    container.innerHTML = products.map(p => `
        <div class="product-card">
            <div>
                <img src="${p.image_url || 'https://via.placeholder.com/150'}" alt="${p.name}">
                <span class="brand-tag">${p.brand || 'General'}</span>
                <h4>${p.name}</h4>
            </div>
            <div>
                <div class="price">K ${parseFloat(p.price).toFixed(2)}</div>
                <button onclick='addToCart(${JSON.stringify(p)})' class="btn-add">+ Add</button>
            </div>
        </div>
    `).join('');
}

// CIRCULAR SHORTCUT HANDLERS
function selectCircleCategory(catName, element) {
    // 1. Update visual active state on category circles
    document.querySelectorAll('#category-circles .circle-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    const searchInput = document.getElementById("search-input");
    const subContainer = document.getElementById("subcategory-circles");

    if (catName === 'ALL') {
        if (searchInput) searchInput.value = "";
        const catSelect = document.getElementById("filter-category");
        if (catSelect) catSelect.value = "ALL";
        handleCategoryChange();
        if (subContainer) subContainer.style.display = 'none';
    } 
    else if (catName === 'Daily Needs') {
        // Expand sub-category circles
        if (subContainer) {
            subContainer.style.display = 'flex';
            subContainer.innerHTML = dailyNeedsSubMap.map((sub, index) => `
                <div class="circle-item ${index === 0 ? 'active' : ''}" onclick="selectCircleSubcategory('${sub.value}', this)">
                    <div class="circle-icon" style="width:46px; height:46px; font-size:1.1rem;">${sub.icon}</div>
                    <span style="font-size:0.68rem;">${sub.name}</span>
                </div>
            `).join('');
        }
        if (searchInput) searchInput.value = "";
        applyFilters();
    } 
    else {
        // For Beauty, Electronics, Deals - search directly
        if (subContainer) subContainer.style.display = 'none';
        if (searchInput) {
            searchInput.value = catName;
            applyFilters();
        }
    }
}

function selectCircleSubcategory(subValue, element) {
    // 1. Update active state on subcategory circles
    document.querySelectorAll('#subcategory-circles .circle-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    const searchInput = document.getElementById("search-input");

    if (subValue === 'ALL') {
        if (searchInput) searchInput.value = "";
    } else {
        if (searchInput) searchInput.value = subValue;
    }
    applyFilters();
}

// QUANTITY-BASED BASKET LOGIC
function addToCart(product) {
    if (cart[product.id]) {
        cart[product.id].qty += 1;
    } else {
        cart[product.id] = { product: product, qty: 1 };
    }
    updateCartUI();
}

function updateQuantity(productId, change) {
    if (cart[productId]) {
        cart[productId].qty += change;
        if (cart[productId].qty <= 0) {
            delete cart[productId];
        }
    }
    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById("cart-items");
    const items = Object.values(cart);

    list.innerHTML = items.map(item => `
        <li style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.85rem;">
            <div>
                <strong>${item.product.name}</strong><br>
                <small>K ${parseFloat(item.product.price).toFixed(2)} x ${item.qty} = <strong>K ${(parseFloat(item.product.price) * item.qty).toFixed(2)}</strong></small>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <button onclick="updateQuantity(${item.product.id}, -1)" style="background: #edf2f7; border: 1px solid #cbd5e0; border-radius: 4px; padding: 2px 8px; font-weight: bold; cursor: pointer;">-</button>
                <span style="font-weight: bold;">${item.qty}</span>
                <button onclick="updateQuantity(${item.product.id}, 1)" style="background: #0baf65; color: white; border: none; border-radius: 4px; padding: 2px 8px; font-weight: bold; cursor: pointer;">+</button>
            </div>
        </li>
    `).join('');
    
    const totalCount = items.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = items.reduce((sum, item) => sum + (parseFloat(item.product.price) * item.qty), 0);

    const countRuleEl = document.getElementById("item-count-rule");
    const priceRuleEl = document.getElementById("price-rule");
    const checkoutBtn = document.getElementById("checkout-btn");

    const hasMinItems = totalCount >= 3;
    const hasMinPrice = totalPrice >= 249.00;

    if (countRuleEl) {
        countRuleEl.innerHTML = hasMinItems ? `✅ Total Items: ${totalCount} (Minimum Met)` : `❌ Total Items: ${totalCount} / 3 min`;
        countRuleEl.style.color = hasMinItems ? "#088a4f" : "#e53e3e";
    }

    if (priceRuleEl) {
        priceRuleEl.innerHTML = hasMinPrice ? `✅ Total: K ${totalPrice.toFixed(2)} (Minimum Met)` : `❌ Total: K ${totalPrice.toFixed(2)} / K 249.00 min`;
        priceRuleEl.style.color = hasMinPrice ? "#088a4f" : "#e53e3e";
    }

    if (checkoutBtn) {
        if (hasMinItems && hasMinPrice) {
            checkoutBtn.disabled = false;
            checkoutBtn.innerText = `Place Combo Order (K ${totalPrice.toFixed(2)})`;
        } else {
            checkoutBtn.disabled = true;
            checkoutBtn.innerText = "Build Min Combo (3 Items & K249) to Order";
        }
    }
}

async function handleCheckout(event) {
    event.preventDefault();
    const items = Object.values(cart);
    const totalCount = items.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = items.reduce((sum, item) => sum + (parseFloat(item.product.price) * item.qty), 0);

    if (totalCount < 3 || totalPrice < 249.00) return alert("Combo criteria not met!");

    const selectedOffice = document.getElementById("workplace-select").value;
    const contactPhone = document.getElementById("customer-phone").value;

    const { error } = await db.from('orders').insert([{
        customer_phone: contactPhone,
        delivery_location: selectedOffice,
        total_amount: totalPrice,
        order_items_json: items,
        status: 'Pending Aggregation'
    }]);

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("Zikomo! Combo order submitted successfully.");
        cart = {};
        updateCartUI();
    }
    function toggleSidebar() {
    const sidebar = document.getElementById("filter-sidebar");
    const overlay = document.getElementById("filter-sidebar-overlay");
    
    if (sidebar && overlay) {
        const isOpen = sidebar.classList.contains("open");
        if (isOpen) {
            sidebar.classList.remove("open");
            overlay.style.display = "none";
        } else {
            sidebar.classList.add("open");
            overlay.style.display = "block";
        }
    }
}
}
