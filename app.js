const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";

let db;
let allProducts = [];
let cart = {};

window.onload = function() {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    loadBanners();
    loadProducts();
};

function toggleSidebar() {
    const sidebar = document.getElementById("filter-sidebar");
    const overlay = document.getElementById("filter-sidebar-overlay");
    if (sidebar && overlay) {
        const isOpen = sidebar.classList.contains("open");
        sidebar.classList.toggle("open");
        overlay.style.display = isOpen ? "none" : "block";
    }
}

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
    buildDynamicMasterFilters();
    renderProducts(allProducts);
}

// DYNAMICALLY BUILD FILTERS & SHORTCUTS DIRECTLY FROM DATABASE MASTER
function buildDynamicMasterFilters() {
    // 1. Build Dropdown Categories
    const categories = ['ALL', ...new Set(allProducts.map(p => p.category).filter(Boolean))];
    const categorySelect = document.getElementById("filter-category");
    if (categorySelect) {
        categorySelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    // 2. Build Category Circle Shortcuts Dynamically from DB
    const categoryCircles = document.getElementById("category-circles");
    if (categoryCircles) {
        const icons = { 'ALL': '🔥', 'Daily Needs': '🛒', 'Beauty': '✨', 'Electronics': '⚡', 'Deals': '🏷️' };
        categoryCircles.innerHTML = categories.map((cat, idx) => `
            <div class="circle-item ${idx === 0 ? 'active' : ''}" onclick="selectCircleCategory('${cat}', this)">
                <div class="circle-icon">${icons[cat] || '📦'}</div>
                <span>${cat}</span>
            </div>
        `).join('');
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

function selectCircleCategory(catName, element) {
    document.querySelectorAll('#category-circles .circle-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    const catSelect = document.getElementById("filter-category");
    if (catSelect) {
        catSelect.value = catName;
        handleCategoryChange();
    }
}

function applyFilters() {
    const cat = document.getElementById("filter-category")?.value || 'ALL';
    const sub = document.getElementById("filter-subcategory")?.value || 'ALL';
    const brand = document.getElementById("filter-brand")?.value || 'ALL';
    const searchQuery = (document.getElementById("search-input")?.value || "").toLowerCase().trim();

    let filtered = allProducts;

    if (cat !== 'ALL') filtered = filtered.filter(p => p.category === cat);
    if (sub !== 'ALL') filtered = filtered.filter(p => p.sub_category === sub);
    if (brand !== 'ALL') filtered = filtered.filter(p => p.brand === brand);

    if (searchQuery !== "") {
        filtered = filtered.filter(p => 
            (p.name && p.name.toLowerCase().includes(searchQuery)) ||
            (p.product_code && p.product_code.toLowerCase().includes(searchQuery)) ||
            (p.category && p.category.toLowerCase().includes(searchQuery)) ||
            (p.sub_category && p.sub_category.toLowerCase().includes(searchQuery)) ||
            (p.brand && p.brand.toLowerCase().includes(searchQuery)) ||
            (p.source && p.source.toLowerCase().includes(searchQuery))
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

    container.innerHTML = products.map(p => {
        const activePrice = p.deal_price ? p.deal_price : p.price;
        return `
            <div class="product-card">
                <div>
                    <img src="${p.image_url || 'https://via.placeholder.com/150'}" alt="${p.name}">
                    <span class="brand-tag">${p.brand || 'General'}</span>
                    <h4>${p.name}</h4>
                    <small style="color:#718096">Code: ${p.product_code || '-'}</small>
                </div>
                <div>
                    <div class="price">
                        K ${parseFloat(activePrice).toFixed(2)}
                        ${p.deal_price ? `<small style="text-decoration:line-through; color:#a0aec0; font-size:0.75rem;">K${parseFloat(p.price).toFixed(2)}</small>` : ''}
                    </div>
                    <button onclick='addToCart(${JSON.stringify(p)})' class="btn-add">+ Add</button>
                </div>
            </div>
        `;
    }).join('');
}

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
        if (cart[productId].qty <= 0) delete cart[productId];
    }
    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById("cart-items");
    const items = Object.values(cart);

    list.innerHTML = items.map(item => {
        const effectivePrice = item.product.deal_price ? item.product.deal_price : item.product.price;
        return `
            <li style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.85rem;">
                <div>
                    <strong>${item.product.name}</strong><br>
                    <small>K ${parseFloat(effectivePrice).toFixed(2)} x ${item.qty} = <strong>K ${(parseFloat(effectivePrice) * item.qty).toFixed(2)}</strong></small>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button onclick="updateQuantity(${item.product.id}, -1)" style="background: #edf2f7; border: 1px solid #cbd5e0; border-radius: 4px; padding: 2px 8px; font-weight: bold; cursor: pointer;">-</button>
                    <span style="font-weight: bold;">${item.qty}</span>
                    <button onclick="updateQuantity(${item.product.id}, 1)" style="background: #0baf65; color: white; border: none; border-radius: 4px; padding: 2px 8px; font-weight: bold; cursor: pointer;">+</button>
                </div>
            </li>
        `;
    }).join('');

    const totalCount = items.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = items.reduce((sum, item) => {
        const p = item.product.deal_price ? item.product.deal_price : item.product.price;
        return sum + (parseFloat(p) * item.qty);
    }, 0);

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
        checkoutBtn.disabled = !(hasMinItems && hasMinPrice);
        checkoutBtn.innerText = (hasMinItems && hasMinPrice) 
            ? `Place Combo Order (K ${totalPrice.toFixed(2)})` 
            : "Build Min Combo (3 Items & K249) to Order";
    }
}

async function handleCheckout(event) {
    event.preventDefault();
    const items = Object.values(cart);
    const totalCount = items.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = items.reduce((sum, item) => {
        const p = item.product.deal_price ? item.product.deal_price : item.product.price;
        return sum + (parseFloat(p) * item.qty);
    }, 0);

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
}
