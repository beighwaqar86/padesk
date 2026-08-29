// YOUR LIVE SUPABASE KEYS
const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";

let db;
let allProducts = [];
let cart = {};
let currentSlide = 0;
let slideInterval;

window.onload = function() {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    loadBanners();
    loadProducts();
    autoPopulateSavedCustomer();
};

// 1. AUTO-POPULATE & STATE BAR ENGINE
function autoPopulateSavedCustomer() {
    const savedPhone = localStorage.getItem("padesk_phone");
    const savedName = localStorage.getItem("padesk_name");
    const savedOffice = localStorage.getItem("padesk_office");

    const stateBar = document.getElementById("user-state-bar");

    if (savedPhone && savedName) {
        // Known User: Render Welcome Back Bar
        if (stateBar) {
            stateBar.style.display = "flex";
            stateBar.innerHTML = `
                <span>Welcome back, <strong>${savedName}</strong>! 👋</span>
                <button type="button" onclick="signOut()" class="btn-link-signout">Sign Out</button>
            `;
        }

        const phoneEl = document.getElementById("customer-phone");
        const nameEl = document.getElementById("customer-name");
        const officeEl = document.getElementById("workplace-select");

        if (phoneEl) phoneEl.value = savedPhone;
        if (nameEl) nameEl.value = savedName;
        if (officeEl && savedOffice) officeEl.value = savedOffice;

        loadPastPurchases(savedPhone);
    } else {
        // Guest User: Render Quick-Login Bar with Explicit Button
        if (stateBar) {
            stateBar.style.display = "flex";
            stateBar.innerHTML = `
                <span>Already ordered?</span>
                <div class="quick-login-input-wrap">
                    <input type="tel" id="quick-phone" placeholder="Enter Phone" onkeypress="if(event.key==='Enter') triggerQuickLogin()">
                    <button type="button" id="btn-quick-login" onclick="triggerQuickLogin()" style="background:#0baf65; color:white; border:none; border-radius:4px; padding:4px 10px; font-weight:bold; cursor:pointer;">Go</button>
                </div>
            `;
        }
        
        resetAccountDrawerUI();
    }
}

// 2. QUICK LOGIN TRIGGER (WITH LOADING STATE)
async function triggerQuickLogin() {
    const input = document.getElementById("quick-phone");
    const btn = document.getElementById("btn-quick-login");
    
    if (input && input.value) {
        if (btn) btn.innerText = "⏳"; // Show loading
        await checkReturningCustomer(input.value, true);
        if (btn && btn.innerText === "⏳") btn.innerText = "Go"; // Reset button
    }
}

// 3. DYNAMIC CUSTOMER LOOKUP (WITH FEEDBACK ALERTS)
async function checkReturningCustomer(phone, isQuickLogin = false) {
    const cleanPhone = phone.trim();
    if (cleanPhone.length < 9) {
        if (isQuickLogin) alert("Please enter a valid phone number.");
        return;
    }

    const { data: customer, error } = await db
        .from('customers')
        .select('*')
        .eq('phone_number', cleanPhone)
        .single();

    if (customer) {
        const nameEl = document.getElementById("customer-name");
        const officeEl = document.getElementById("workplace-select");
        const phoneEl = document.getElementById("customer-phone");

        if (nameEl) nameEl.value = customer.full_name;
        if (officeEl) officeEl.value = customer.default_office;
        if (phoneEl) phoneEl.value = customer.phone_number;

        // Cache the login locally
        localStorage.setItem("padesk_phone", customer.phone_number);
        localStorage.setItem("padesk_name", customer.full_name);
        localStorage.setItem("padesk_office", customer.default_office);

        // Refresh the UI
        autoPopulateSavedCustomer();
        
        if (isQuickLogin) alert(`Welcome back, ${customer.full_name}! Your profile and past purchases have been loaded.`);
    } else {
        if (isQuickLogin) {
            alert("No account found for this number. If you are new, simply build your combo and checkout below to create your account!");
        }
    }
}

// 4. LOAD PAST PURCHASES SLIDER (FOR REORDER HINT)
async function loadPastPurchases(phone) {
    const { data: orders } = await db
        .from('orders')
        .select('order_items_json')
        .eq('customer_phone', phone);

    if (!orders || orders.length === 0) return;

    const pastItemsMap = {};
    orders.forEach(o => {
        const items = o.order_items_json || [];
        items.forEach(item => {
            const p = item.product;
            if (p && !pastItemsMap[p.id]) pastItemsMap[p.id] = p;
        });
    });

    const uniquePastProducts = Object.values(pastItemsMap);
    const sliderContainer = document.getElementById("past-purchases-slider");
    const sectionContainer = document.getElementById("past-purchases-section");

    if (uniquePastProducts.length > 0 && sliderContainer && sectionContainer) {
        sectionContainer.style.display = "block";
        sliderContainer.innerHTML = uniquePastProducts.map(p => `
            <div class="past-card">
                <div>
                    <span class="brand-tag">${p.brand || 'General'}</span>
                    <h5>${p.name}</h5>
                    <div class="price" style="font-size:0.8rem; margin:2px 0;">K ${parseFloat(p.deal_price || p.price).toFixed(2)}</div>
                </div>
                <button onclick='addToCart(${JSON.stringify(p)})' class="btn-add" style="padding:4px 8px; font-size:0.75rem;">+ Reorder</button>
            </div>
        `).join('');
    }
}

// 5. ACCOUNT DETAILS DRAWER TOGGLE & HISTORY FETCH
function toggleAccountDrawer() {
    const drawer = document.getElementById("account-drawer");
    const overlay = document.getElementById("account-drawer-overlay");
    if (drawer && overlay) {
        const isOpen = drawer.classList.contains("open");
        drawer.classList.toggle("open");
        overlay.style.display = isOpen ? "none" : "block";

        const savedPhone = localStorage.getItem("padesk_phone");
        if (!isOpen) {
            if (savedPhone) {
                loadAccountHistory(savedPhone);
            } else {
                resetAccountDrawerUI();
            }
        }
    }
}

async function loadAccountHistory(phone) {
    const profileBox = document.getElementById("account-profile-info");
    const historyList = document.getElementById("account-order-history");
    const signOutBtn = document.getElementById("drawer-signout-btn");

    const savedName = localStorage.getItem("padesk_name") || "Valued Shopper";
    const savedOffice = localStorage.getItem("padesk_office") || "Not set";

    if (profileBox) {
        profileBox.innerHTML = `
            <strong>${savedName}</strong><br>
            <small>📱 Phone: ${phone}</small><br>
            <small>🏢 Office: ${savedOffice}</small>
        `;
    }

    if (signOutBtn) signOutBtn.style.display = "block";

    const { data: orders } = await db
        .from('orders')
        .select('*')
        .eq('customer_phone', phone)
        .order('id', { ascending: false });

    if (historyList) {
        if (!orders || orders.length === 0) {
            historyList.innerHTML = "<p><small>No past orders found.</small></p>";
        } else {
            historyList.innerHTML = orders.map(o => `
                <div class="order-card-mini">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>Order #${o.id}</strong>
                        <span style="color:#0baf65; font-weight:bold;">K ${parseFloat(o.total_amount).toFixed(2)}</span>
                    </div>
                    <small style="color:#718096;">Location: ${o.delivery_location || '-'}</small>
                </div>
            `).join('');
        }
    }
}

// 6. SIDEBAR DRAWER TOGGLE LOGIC
function toggleSidebar() {
    const sidebar = document.getElementById("filter-sidebar");
    const overlay = document.getElementById("filter-sidebar-overlay");
    if (sidebar && overlay) {
        const isOpen = sidebar.classList.contains("open");
        sidebar.classList.toggle("open");
        overlay.style.display = isOpen ? "none" : "block";
    }
}

// 7. HERO BANNER SLIDER LOGIC
async function loadBanners() {
    const { data: banners } = await db.from('banners').select('*').eq('is_active', true);
    if (!banners || banners.length === 0) return;

    const container = document.getElementById("banner-carousel");
    const dotsContainer = document.getElementById("slider-dots");

    if (container) {
        container.innerHTML = banners.map(b => `
            <div class="banner-card" style="background-image: url('${b.image_url}');">
                <div class="banner-overlay">
                    <h4>${b.title || ''}</h4>
                    <p>${b.subtitle || ''}</p>
                </div>
            </div>
        `).join('');

        if (dotsContainer) {
            dotsContainer.innerHTML = banners.map((_, idx) => `
                <span class="dot ${idx === 0 ? 'active' : ''}" id="dot-${idx}"></span>
            `).join('');
        }

        startAutoSlide(banners.length);
        container.addEventListener('scroll', () => syncDotsOnScroll(banners.length));
    }
}

function startAutoSlide(totalSlides) {
    clearInterval(slideInterval);
    slideInterval = setInterval(() => {
        const container = document.getElementById("banner-carousel");
        if (!container) return;

        currentSlide = (currentSlide + 1) % totalSlides;
        const slideWidth = container.querySelector('.banner-card')?.offsetWidth || 280;
        container.scrollTo({ left: (slideWidth + 12) * currentSlide, behavior: 'smooth' });
    }, 4000);
}

function syncDotsOnScroll(totalSlides) {
    const container = document.getElementById("banner-carousel");
    if (!container) return;

    const slideWidth = container.querySelector('.banner-card')?.offsetWidth || 280;
    const activeIdx = Math.round(container.scrollLeft / (slideWidth + 12));

    for (let i = 0; i < totalSlides; i++) {
        const dot = document.getElementById(`dot-${i}`);
        if (dot) dot.classList.toggle('active', i === activeIdx);
    }
}

// 8. FETCH PRODUCTS FROM DATABASE MASTER
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

// 9. BUILD FILTERS & CIRCLE SHORTCUTS DYNAMICALLY FROM DB MASTER
function buildDynamicMasterFilters() {
    const categories = ['ALL', ...new Set(allProducts.map(p => p.category).filter(Boolean))];
    const categorySelect = document.getElementById("filter-category");
    if (categorySelect) {
        categorySelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }

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

// 10. UNIVERSAL SEARCH & FILTER ENGINE
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

// 11. QUANTITY BASKET & COMBO ENGINE
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

// 12. CHECKOUT WITH IMPLICIT CUSTOMER PROFILE UPSERT
async function handleCheckout(event) {
    event.preventDefault();
    const items = Object.values(cart);
    const totalCount = items.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = items.reduce((sum, item) => {
        const p = item.product.deal_price ? item.product.deal_price : item.product.price;
        return sum + (parseFloat(p) * item.qty);
    }, 0);

    if (totalCount < 3 || totalPrice < 249.00) return alert("Combo criteria not met!");

    const contactPhone = document.getElementById("customer-phone").value.trim();
    const customerName = document.getElementById("customer-name").value.trim();
    const selectedOffice = document.getElementById("workplace-select").value;

    const { error: custError } = await db.from('customers').upsert([{
        phone_number: contactPhone,
        full_name: customerName,
        default_office: selectedOffice,
        last_order_at: new Date().toISOString()
    }], { onConflict: 'phone_number' });

    if (custError) {
        console.error("Customer record creation error:", custError.message);
    }

    const { error: orderError } = await db.from('orders').insert([{
        customer_phone: contactPhone,
        delivery_location: selectedOffice,
        total_amount: totalPrice,
        order_items_json: items,
        status: 'Pending Aggregation'
    }]);

    if (orderError) {
        alert("Error submitting order: " + orderError.message);
    } else {
        localStorage.setItem("padesk_phone", contactPhone);
        localStorage.setItem("padesk_name", customerName);
        localStorage.setItem("padesk_office", selectedOffice);

        cart = {};
        updateCartUI();
        autoPopulateSavedCustomer();
    }
}
