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
    const savedTitle = localStorage.getItem("padesk_title") || "";
    const savedFirstName = localStorage.getItem("padesk_first_name") || "";
    const savedLastName = localStorage.getItem("padesk_last_name") || "";
    const savedOffice = localStorage.getItem("padesk_office") || "";

    const stateBar = document.getElementById("user-state-bar");
    const displayName = savedTitle && savedLastName ? `${savedTitle} ${savedLastName}` : (savedFirstName || "Shopper");

    if (savedPhone) {
        if (stateBar) {
            stateBar.style.display = "flex";
            stateBar.innerHTML = `
                <span>Welcome back, <strong>${displayName}</strong>! 👋</span>
                <button type="button" onclick="signOut()" class="btn-link-signout">Sign Out</button>
            `;
        }

        if (document.getElementById("customer-phone")) document.getElementById("customer-phone").value = savedPhone;
        if (document.getElementById("customer-title")) document.getElementById("customer-title").value = savedTitle;
        if (document.getElementById("customer-first-name")) document.getElementById("customer-first-name").value = savedFirstName;
        if (document.getElementById("customer-last-name")) document.getElementById("customer-last-name").value = savedLastName;
        if (document.getElementById("workplace-select") && savedOffice) document.getElementById("workplace-select").value = savedOffice;

        loadPastPurchases(savedPhone);
    } else {
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

// 2. SIGN-OUT FUNCTION
function signOut() {
    localStorage.removeItem("padesk_phone");
    localStorage.removeItem("padesk_title");
    localStorage.removeItem("padesk_first_name");
    localStorage.removeItem("padesk_last_name");
    localStorage.removeItem("padesk_office");
    localStorage.removeItem("padesk_name");

    if (document.getElementById("customer-phone")) document.getElementById("customer-phone").value = "";
    if (document.getElementById("customer-title")) document.getElementById("customer-title").value = "";
    if (document.getElementById("customer-first-name")) document.getElementById("customer-first-name").value = "";
    if (document.getElementById("customer-last-name")) document.getElementById("customer-last-name").value = "";
    if (document.getElementById("workplace-select")) document.getElementById("workplace-select").value = "";

    const pastSection = document.getElementById("past-purchases-section");
    if (pastSection) pastSection.style.display = "none";

    resetAccountDrawerUI();

    const accountDrawer = document.getElementById("account-drawer");
    if (accountDrawer && accountDrawer.classList.contains("open")) {
        toggleAccountDrawer();
    }

    autoPopulateSavedCustomer();
}

function resetAccountDrawerUI() {
    const profileBox = document.getElementById("account-profile-info");
    const historyList = document.getElementById("account-order-history");
    const signOutBtn = document.getElementById("drawer-signout-btn");

    if (profileBox) {
        profileBox.innerHTML = `
            <p style="margin:0;"><small>You are currently browsing as a <strong>Guest</strong>.</small></p>
            <small style="color:#718096;">Enter your mobile number at checkout or in the top bar to load your account profile.</small>
        `;
    }
    if (historyList) {
        historyList.innerHTML = "<p><small>No active session found.</small></p>";
    }
    if (signOutBtn) {
        signOutBtn.style.display = "none";
    }
}

// 3. QUICK LOGIN TRIGGER
async function triggerQuickLogin() {
    const input = document.getElementById("quick-phone");
    const btn = document.getElementById("btn-quick-login");
    
    if (input && input.value) {
        if (btn) btn.innerText = "⏳";
        await checkReturningCustomer(input.value, true);
        if (btn && btn.innerText === "⏳") btn.innerText = "Go";
    }
}

// 4. DYNAMIC CUSTOMER LOOKUP
async function checkReturningCustomer(phone, isQuickLogin = false) {
    const cleanPhone = phone.trim();
    if (cleanPhone.length < 9) {
        if (isQuickLogin) alert("Please enter a valid phone number.");
        return;
    }

    try {
        const { data: customer, error } = await db
            .from('customers')
            .select('*')
            .eq('phone_number', cleanPhone)
            .single();

        if (customer) {
            if (document.getElementById("customer-title")) document.getElementById("customer-title").value = customer.title || "";
            if (document.getElementById("customer-first-name")) document.getElementById("customer-first-name").value = customer.first_name || "";
            if (document.getElementById("customer-last-name")) document.getElementById("customer-last-name").value = customer.last_name || "";
            if (document.getElementById("workplace-select")) document.getElementById("workplace-select").value = customer.default_office || "";
            if (document.getElementById("customer-phone")) document.getElementById("customer-phone").value = customer.phone_number;

            localStorage.setItem("padesk_phone", customer.phone_number);
            localStorage.setItem("padesk_title", customer.title || "");
            localStorage.setItem("padesk_first_name", customer.first_name || "");
            localStorage.setItem("padesk_last_name", customer.last_name || "");
            localStorage.setItem("padesk_office", customer.default_office || "");

            autoPopulateSavedCustomer();
            
            if (isQuickLogin) {
                const displayName = customer.title && customer.last_name ? `${customer.title} ${customer.last_name}` : (customer.first_name || "Shopper");
                alert(`Welcome back, ${displayName}!`);
            }
        } else {
            if (isQuickLogin) {
                alert("No account found for this number. Simply build your combo below to get started!");
            }
        }
    } catch (err) {
        console.error("Lookup error:", err);
        if (isQuickLogin) alert("Error connecting to database. Please try again.");
    }
}

// 5. LOAD PAST PURCHASES SLIDER
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

// 6. ACCOUNT DETAILS DRAWER TOGGLE & HISTORY FETCH
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

    const savedTitle = localStorage.getItem("padesk_title") || "";
    const savedFirstName = localStorage.getItem("padesk_first_name") || "Valued Shopper";
    const savedLastName = localStorage.getItem("padesk_last_name") || "";
    const savedOffice = localStorage.getItem("padesk_office") || "Not set";

    if (profileBox) {
        profileBox.innerHTML = `
            <strong>${savedTitle} ${savedFirstName} ${savedLastName}</strong><br>
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

// 7. SIDEBAR DRAWER TOGGLE LOGIC
function toggleSidebar() {
    const sidebar = document.getElementById("filter-sidebar");
    const overlay = document.getElementById("filter-sidebar-overlay");
    if (sidebar && overlay) {
        const isOpen = sidebar.classList.contains("open");
        sidebar.classList.toggle("open");
        overlay.style.display = isOpen ? "none" : "block";
    }
}

// 8. HERO BANNER SLIDER LOGIC
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

// 9. FETCH PRODUCTS FROM DATABASE MASTER
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

// 10. BUILD FILTERS & CIRCLE SHORTCUTS
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

// 11. UNIVERSAL SEARCH & FILTER ENGINE
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

// 12. QUANTITY BASKET & COMBO ENGINE
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

// 13. CHECKOUT WITH IMPLICIT CUSTOMER PROFILE UPSERT
async function handleCheckout(event) {
    event.preventDefault();
    
    try {
        const btn = document.getElementById("checkout-btn");
        btn.innerText = "⏳ Processing Order...";
        btn.disabled = true;

        const items = Object.values(cart);
        const totalCount = items.reduce((sum, item) => sum + item.qty, 0);
        const totalPrice = items.reduce((sum, item) => {
            const p = item.product.deal_price ? item.product.deal_price : item.product.price;
            return sum + (parseFloat(p) * item.qty);
        }, 0);

        if (totalCount < 3 || totalPrice < 249.00) {
            updateCartUI();
            return alert("Combo criteria not met!");
        }

        const contactPhone = document.getElementById("customer-phone").value.trim();
        const cTitle = document.getElementById("customer-title").value;
        const cFirstName = document.getElementById("customer-first-name").value.trim();
        const cLastName = document.getElementById("customer-last-name").value.trim();
        const selectedOffice = document.getElementById("workplace-select").value;

        const { error: custError } = await db.from('customers').upsert([{
            phone_number: contactPhone,
            title: cTitle,
            first_name: cFirstName,
            last_name: cLastName,
            default_office: selectedOffice,
            last_order_at: new Date().toISOString()
        }], { onConflict: 'phone_number' });

        if (custError) {
            throw new Error("Supabase Customers Table Error: " + custError.message);
        }

        const { error: orderError } = await db.from('orders').insert([{
            customer_phone: contactPhone,
            delivery_location: selectedOffice,
            total_amount: totalPrice,
            order_items_json: items,
            status: 'Pending Aggregation'
        }]);

        if (orderError) {
            throw new Error("Supabase Orders Table Error: " + orderError.message);
        }

        localStorage.setItem("padesk_phone", contactPhone);
        localStorage.setItem("padesk_title", cTitle);
        localStorage.setItem("padesk_first_name", cFirstName);
        localStorage.setItem("padesk_last_name", cLastName);
        localStorage.setItem("padesk_office", selectedOffice);

        cart = {};
        updateCartUI();
        autoPopulateSavedCustomer();
        
        alert(`Zikomo ${cTitle} ${cLastName || cFirstName}! Your combo order has been submitted successfully.`);

    } catch (error) {
        console.error(error);
        alert("Action Failed:\n" + error.message);
        updateCartUI();
    }
}
