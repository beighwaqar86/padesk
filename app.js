// YOUR LIVE SUPABASE KEYS
const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";

let db;
let allProducts = [];
let cart = [];

window.onload = function() {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    loadBanners();
    loadProducts();
};

async function loadBanners() {
    const { data: banners } = await db.from('banners').select('*').eq('is_active', true);
    if (!banners || banners.length === 0) return;

    const container = document.getElementById("banner-carousel");
    container.innerHTML = banners.map(b => `
        <div class="banner-card" style="background-image: url('${b.image_url}');">
            <div class="banner-overlay">
                <h4>${b.title || ''}</h4>
                <p>${b.subtitle || ''}</p>
            </div>
        </div>
    `).join('');
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

function applyFilters() {
    const cat = document.getElementById("filter-category").value;
    const sub = document.getElementById("filter-subcategory").value;
    const brand = document.getElementById("filter-brand").value;

    let filtered = allProducts;
    if (cat !== 'ALL') filtered = filtered.filter(p => p.category === cat);
    if (sub !== 'ALL') filtered = filtered.filter(p => p.sub_category === sub);
    if (brand !== 'ALL') filtered = filtered.filter(p => p.brand === brand);

    renderProducts(filtered);
}

function renderProducts(products) {
    const container = document.getElementById("product-list");
    if (products.length === 0) {
        container.innerHTML = "<p><small>No items match these filters.</small></p>";
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

function addToCart(product) {
    cart.push(product);
    updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById("cart-items");
    list.innerHTML = cart.map((item, index) => `
        <li style="font-size: 0.85rem; margin-bottom: 4px;">
            ${item.name} - <strong>K ${parseFloat(item.price).toFixed(2)}</strong>
            <button onclick="removeFromCart(${index})" style="color:red; background:none; border:none; cursor:pointer;">✕</button>
        </li>
    `).join('');
    
    const totalCount = cart.length;
    const totalPrice = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);

    const countRuleEl = document.getElementById("item-count-rule");
    const priceRuleEl = document.getElementById("price-rule");
    const checkoutBtn = document.getElementById("checkout-btn");

    const hasMinItems = totalCount >= 3;
    const hasMinPrice = totalPrice >= 249.00;

    countRuleEl.innerHTML = hasMinItems ? `✅ Items: ${totalCount} (Minimum Met)` : `❌ Items: ${totalCount} / 3 min`;
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
    const totalPrice = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
    if (cart.length < 3 || totalPrice < 249.00) return alert("Combo criteria not met!");

    const selectedOffice = document.getElementById("workplace-select").value;
    const contactPhone = document.getElementById("customer-phone").value;

    const { error } = await db.from('orders').insert([{
        customer_phone: contactPhone,
        delivery_location: selectedOffice,
        total_amount: totalPrice,
        order_items_json: cart,
        status: 'Pending Aggregation'
    }]);

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("Zikomo! Combo order submitted successfully.");
        cart = [];
        updateCartUI();
    }
}
