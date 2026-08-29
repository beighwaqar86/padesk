// YOUR LIVE SUPABASE KEYS
const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";

let db;
let allProducts = [];
let cart = {}; // Object format: { productId: { product, qty } }

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
    categorySelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');

    handleCategoryChange();
}

function handleCategoryChange() {
    const selectedCategory = document.getElementById("filter-category").value;

    const filteredForSub = selectedCategory === 'ALL' 
        ? allProducts 
        : allProducts.filter(p => p.category === selectedCategory);

    const subcategories = ['ALL', ...new Set(filteredForSub.map(p => p.sub_category).filter(Boolean))];
    const subSelect = document.getElementById("filter-subcategory");
    subSelect.innerHTML = subcategories.map(s => `<option value="${s}">${s}</option>`).join('');

    const brands = ['ALL', ...new Set(filteredForSub.map(p => p.brand).filter(Boolean))];
    const brandSelect = document.getElementById("filter-brand");
    brandSelect.innerHTML = brands.map(b => `<option value="${b}">${b}</option>`).join('');

    applyFilters();
}

// UNIVERSAL FILTER + SEARCH ENGINE
function applyFilters() {
    const cat = document.getElementById("filter-category").value;
    const sub = document.getElementById("filter-subcategory").value;
    const brand = document.getElementById("filter-brand").value;
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
    
    // Calculate total distinct item units and total price
    const totalCount = items.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = items.reduce((sum, item) => sum + (parseFloat(item.product.price) * item.qty), 0);

    const countRuleEl = document.getElementById("item-count-rule");
    const priceRuleEl = document.getElementById("price-rule");
    const checkoutBtn = document.getElementById("checkout-btn");

    const hasMinItems = totalCount >= 3;
    const hasMinPrice = totalPrice >= 249.00;

    countRuleEl.innerHTML = hasMinItems ? `✅ Total Items: ${totalCount} (Minimum Met)` : `❌ Total Items: ${totalCount} / 3 min`;
    countRuleEl.style.color = hasMinItems ? "#088a4f" : "#e53e3e";

    priceRuleEl.innerHTML = hasMinPrice ? `✅ Total: K ${totalPrice.toFixed(2)} (Minimum Met)` : `❌ Total: K ${totalPrice.toFixed(2)} / K 249.00 min`;
    priceRuleEl.style.color = hasMinPrice ? "#088a4f" : "#e53e3e";

    if (hasMinItems && hasMinPrice) {
        checkoutBtn.disabled = false;
        checkoutBtn.innerText = `Place Combo Order (K ${totalPrice.toFixed(2)})`;
    } else {
        checkoutBtn.disabled = true;
        checkoutBtn.innerText = "Build Min Combo (3 Items & K249) to Order";
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
        order_items_json: items, // Contains formatted quantity array
        status: 'Pending Aggregation'
    }]);

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("Zikomo! Combo order submitted successfully.");
        cart = {};
        updateCartUI();
    }
}
