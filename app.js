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

// Scroll to cart selection section when header cart graphic is clicked
function scrollToCartSection() {
    const cartSection = document.getElementById("cart-section");
    if (cartSection) {
        cartSection.scrollIntoView({ behavior: 'smooth' });
    }
}

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
        loadCustomerCustomCombos(savedPhone);
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

    const customCombosSection = document.getElementById("custom-combos-section");
    if (customCombosSection) customCombosSection.style.display = "none";

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

// 5. LOAD PAST PURCHASES SLIDER & CUSTOMER COMBOS
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
                <button onclick='addToCart(${JSON.stringify(p)}, event)' class="btn-add" style="padding:4px 8px; font-size:0.75rem;">+ Add to Combo</button>
            </div>
        `).join('');
    }
}

async function loadCustomerCustomCombos(phone) {
    const { data: combos } = await db.from('customer_combos').select('*').eq('customer_phone', phone);
    
    const sliderContainer = document.getElementById("custom-combos-slider");
    const sectionContainer = document.getElementById("custom-combos-section");

    if (!combos || combos.length === 0) {
        if (sectionContainer) sectionContainer.style.display = "none";
        return;
    }

    if (sliderContainer && sectionContainer) {
        sectionContainer.style.display = "block";
        sliderContainer.innerHTML = combos.map(c => {
            const encodedItems = encodeURIComponent(JSON.stringify(c.items_json));
            return `
                <div class="past-card" style="min-width: 180px; background: #e6f7f0; border-color: #b2f5ea;">
                    <div>
                        <span class="brand-tag" style="color: #088a4f;">Saved Combo</span>
                        <h5 style="margin: 4px 0; font-size: 0.85rem;">${c.combo_name}</h5>
                        <small style="color: #718096; font-size: 0.7rem;">${(c.items_json || []).length} items included</small>
                    </div>
                    <button type="button" onclick="addBannerComboToCart('${encodedItems}', '${c.combo_name}')" class="btn-add" style="margin-top: 8px; padding: 4px 8px; font-size: 0.75rem; background: #0baf65;">+ Add Combo</button>
                </div>
            `;
        }).join('');
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
                        <strong>${o.order_number || ('Order #' + o.id)}</strong>
                        <span style="color:#0baf65; font-weight:bold;">K ${parseFloat(o.total_amount).toFixed(2)}</span>
                    </div>
                    <small style="color:#718096;">Location: ${o.delivery_location || '-'}</small>
                </div>
            `).join('');
        }
    }
}

// 8. READY-MADE ADMIN COMBO BANNERS SLIDER (+ Add Combo positioned on top right corner)
async function loadBanners() {
    const { data: banners } = await db.from('banners').select('*').eq('is_active', true);
    if (!banners || banners.length === 0) return;

    const container = document.getElementById("banner-carousel");
    const dotsContainer = document.getElementById("slider-dots");

    if (container) {
        container.innerHTML = banners.map(b => {
            const encodedItems = b.items_json ? encodeURIComponent(JSON.stringify(b.items_json)) : '';
            const comboTitle = b.title || 'Combo';

            return `
                <div class="banner-card" style="background-image: url('${b.image_url}'); position: relative;">
                    ${b.items_json ? `
                        <button type="button" onclick="addBannerComboToCart('${encodedItems}', '${comboTitle}')" class="btn-add-combo" style="position: absolute; top: 10px; right: 10px; background: #0baf65; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index: 5;">
                            + Add Combo
                        </button>
                    ` : ''}
                    <div class="banner-overlay" style="display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start;">
                        <span style="background: #0baf65; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Ready Combo</span>
                        <h4 style="margin: 0 0 2px; font-size: 0.95rem;">${b.title || ''}</h4>
                        <p style="margin: 0; font-size: 0.75rem; opacity: 0.95;">${b.subtitle || ''}</p>
                    </div>
                </div>
            `;
        }).join('');

        if (dotsContainer) {
            dotsContainer.innerHTML = banners.map((_, idx) => `
                <span class="dot ${idx === 0 ? 'active' : ''}" id="dot-${idx}"></span>
            `).join('');
        }

        startAutoSlide(banners.length);
        container.addEventListener('scroll', () => syncDotsOnScroll(banners.length));
    }
}

function addBannerComboToCart(encodedItems, comboTitle) {
    try {
        const decodedString = decodeURIComponent(encodedItems);
        const comboItems = JSON.parse(decodedString);

        if (!Array.isArray(comboItems) || comboItems.length === 0) {
            return alert("No items found in this combo.");
        }

        comboItems.forEach(ci => {
            const product = ci.product;
            const qty = ci.qty || 1;

            if (product && product.id) {
                if (cart[product.id]) {
                    cart[product.id].qty += qty;
                } else {
                    cart[product.id] = { product: product, qty: qty };
                }
            }
        });

        updateCartUI();
        alert(`⚡ "${comboTitle}" added to your cart successfully! Check your minimum combo criteria below.`);
    } catch (e) {
        console.error("Error adding combo:", e);
        alert("Could not process this combo items list.");
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
    const { data: products, error } = await db.from('products').select('*').eq('is_active', true);
    if (error || !products) {
        document.getElementById("product-list").innerText = "Failed to load products.";
        return;
    }

    allProducts = products;
    buildDynamicMasterFilters();
    renderProducts(allProducts);
}

// 10. HIERARCHICAL DRILL-DOWN FILTERS (BUSINESS -> CATEGORY -> SUBCATEGORY)
// 10. HIERARCHICAL DRILL-DOWN FILTERS (WITH MODERN THUMBNAIL IMAGES)
function buildDynamicMasterFilters() {
    const businesses = ['ALL', ...new Set(allProducts.map(p => p.business).filter(Boolean))];
    const businessCircles = document.getElementById("business-circles");
    
    // Curated high-res aesthetic thumbnails for each business division
    const businessImages = {
        'ALL': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80',
        'Groceries': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80',
        'Health & Beauty': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=300&q=80',
        'Stationery': 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=300&q=80',
        'Electronics': 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=300&q=80'
    };

    if (businessCircles) {
        businessCircles.innerHTML = businesses.map((bus, idx) => {
            const bgImg = businessImages[bus] || businessImages['ALL'];
            return `
                <div class="circle-item ${idx === 0 ? 'active' : ''}" onclick="selectBusinessCircle('${bus}', this)">
                    <div class="circle-icon" style="background-image: url('${bgImg}'); background-size: cover; background-position: center; border: 2px solid ${idx === 0 ? '#0baf65' : '#e2e8f0'};"></div>
                    <span>${bus}</span>
                </div>
            `;
        }).join('');
    }

    applyFilters();
}

function selectBusinessCircle(businessName, element) {
    document.querySelectorAll('#business-circles .circle-item').forEach(el => {
        el.classList.remove('active');
        const iconDiv = el.querySelector('.circle-icon');
        if (iconDiv) iconDiv.style.borderColor = '#e2e8f0';
    });
    
    if (element) {
        element.classList.add('active');
        const activeIcon = element.querySelector('.circle-icon');
        if (activeIcon) activeIcon.style.borderColor = '#0baf65';
    }

    const catCirclesContainer = document.getElementById("category-circles");
    const subCirclesContainer = document.getElementById("subcategory-circles");
    
    subCirclesContainer.style.display = 'none';

    if (businessName === 'ALL') {
        catCirclesContainer.style.display = 'none';
    } else {
        const busProducts = allProducts.filter(p => p.business === businessName);
        const categories = ['ALL', ...new Set(busProducts.map(p => p.category).filter(Boolean))];

        if (categories.length > 1) {
            catCirclesContainer.style.display = 'flex';
            catCirclesContainer.innerHTML = categories.map((cat, idx) => `
                <div class="circle-item ${idx === 0 ? 'active' : ''}" onclick="selectCategoryCircle('${businessName}', '${cat}', this)">
                    <div class="circle-icon" style="width:48px; height:48px; background: linear-gradient(135deg, #f7fafc, #edf2f7); border: 2px solid ${idx === 0 ? '#0baf65' : '#cbd5e0'}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">📦</div>
                    <span style="font-size:0.68rem;">${cat}</span>
                </div>
            `).join('');
        } else {
            catCirclesContainer.style.display = 'none';
        }
    }

    applyFilters();
}

function selectCategoryCircle(businessName, categoryName, element) {
    document.querySelectorAll('#category-circles .circle-item').forEach(el => {
        el.classList.remove('active');
        const iconDiv = el.querySelector('.circle-icon');
        if (iconDiv) iconDiv.style.borderColor = '#cbd5e0';
    });

    if (element) {
        element.classList.add('active');
        const activeIcon = element.querySelector('.circle-icon');
        if (activeIcon) activeIcon.style.borderColor = '#0baf65';
    }

    const subCirclesContainer = document.getElementById("subcategory-circles");

    if (categoryName === 'ALL') {
        subCirclesContainer.style.display = 'none';
    } else {
        const catProducts = allProducts.filter(p => p.business === businessName && p.category === categoryName);
        const subcategories = ['ALL', ...new Set(catProducts.map(p => p.sub_category).filter(Boolean))];

        if (subcategories.length > 1) {
            subCirclesContainer.style.display = 'flex';
            subCirclesContainer.innerHTML = subcategories.map((sub, idx) => `
                <div class="circle-item ${idx === 0 ? 'active' : ''}" onclick="selectSubcategoryCircle('${sub}', this)">
                    <div class="circle-icon" style="width:42px; height:42px; background: #edf2f7; border: 2px solid ${idx === 0 ? '#0baf65' : '#cbd5e0'}; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">📌</div>
                    <span style="font-size:0.65rem;">${sub}</span>
                </div>
            `).join('');
        } else {
            subCirclesContainer.style.display = 'none';
        }
    }

    applyFilters();
}

function selectSubcategoryCircle(subName, element) {
    document.querySelectorAll('#subcategory-circles .circle-item').forEach(el => {
        el.classList.remove('active');
        const iconDiv = el.querySelector('.circle-icon');
        if (iconDiv) iconDiv.style.borderColor = '#cbd5e0';
    });

    if (element) {
        element.classList.add('active');
        const activeIcon = element.querySelector('.circle-icon');
        if (activeIcon) activeIcon.style.borderColor = '#0baf65';
    }

    applyFilters();
}


// 11. UNIVERSAL SEARCH & HIERARCHICAL FILTER ENGINE
function applyFilters() {
    const activeBusinessEl = document.querySelector('#business-circles .circle-item.active span');
    const activeCategoryEl = document.querySelector('#category-circles .circle-item.active span');
    const activeSubcategoryEl = document.querySelector('#subcategory-circles .circle-item.active span');

    const selectedBusiness = activeBusinessEl ? activeBusinessEl.innerText : 'ALL';
    const selectedCategory = activeCategoryEl ? activeCategoryEl.innerText : 'ALL';
    const selectedSubcategory = activeSubcategoryEl ? activeSubcategoryEl.innerText : 'ALL';

    const searchQuery = (document.getElementById("search-input")?.value || "").toLowerCase().trim();

    let filtered = allProducts;

    if (selectedBusiness !== 'ALL') {
        filtered = filtered.filter(p => p.business === selectedBusiness);
    }
    
    const catContainer = document.getElementById("category-circles");
    if (catContainer && catContainer.style.display !== 'none' && selectedCategory !== 'ALL') {
        filtered = filtered.filter(p => p.category === selectedCategory);
    }

    const subContainer = document.getElementById("subcategory-circles");
    if (subContainer && subContainer.style.display !== 'none' && selectedSubcategory !== 'ALL') {
        filtered = filtered.filter(p => p.sub_category === selectedSubcategory);
    }

    if (searchQuery !== "") {
        filtered = filtered.filter(p => 
            (p.name && p.name.toLowerCase().includes(searchQuery)) ||
            (p.product_code && p.product_code.toLowerCase().includes(searchQuery)) ||
            (p.category && p.category.toLowerCase().includes(searchQuery)) ||
            (p.sub_category && p.sub_category.toLowerCase().includes(searchQuery)) ||
            (p.brand && p.brand.toLowerCase().includes(searchQuery)) ||
            (p.business && p.business.toLowerCase().includes(searchQuery))
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
                    <button onclick='addToCart(${JSON.stringify(p)}, event)' class="btn-add">+ Add</button>
                </div>
            </div>
        `;
    }).join('');
}

// 12. QUANTITY BASKET & COMBO ENGINE
function addToCart(product, event) {
    if (cart[product.id]) {
        cart[product.id].qty += 1;
    } else {
        cart[product.id] = { product: product, qty: 1 };
    }
    updateCartUI();

    if (event && event.target) {
        const btn = event.target;
        const originalText = btn.innerText;
        
        btn.innerText = "Added ✓";
        btn.classList.add("success");
        btn.disabled = true;

        setTimeout(() => {
            btn.innerText = originalText;
            btn.classList.remove("success");
            btn.disabled = false;
        }, 800);
    }

    const cartCard = document.getElementById("cart-section");
    if (cartCard) {
        cartCard.classList.add("pulse");
        setTimeout(() => cartCard.classList.remove("pulse"), 300);
    }
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

    // Update the quick-jump cart button badge count in the search bar
    const headerCartCountEl = document.getElementById("header-cart-count");
    if (headerCartCountEl) {
        headerCartCountEl.innerText = totalCount;
    }

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

// 13. CHECKOUT PREVIEW MODAL FLOW
function handleCheckout(event) {
    event.preventDefault();

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
    
    const paymentMethodSelect = document.getElementById("payment-method-select");
    const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : "";

    if (!paymentMethod) {
        alert("Please select a payment option before checkout.");
        return;
    }

    document.getElementById("preview-customer-details").innerHTML = `
        <strong>${cTitle} ${cFirstName} ${cLastName}</strong><br>
        <small>📱 Phone: ${contactPhone}</small><br>
        <small>📍 Delivery Point: <strong>${selectedOffice}</strong></small>
    `;

    document.getElementById("preview-items-list").innerHTML = items.map(item => {
        const effectivePrice = item.product.deal_price ? item.product.deal_price : item.product.price;
        return `
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 6px;">
                <span>${item.qty}x ${item.product.name}</span>
                <strong>K ${(parseFloat(effectivePrice) * item.qty).toFixed(2)}</strong>
            </div>
        `;
    }).join('');

    document.getElementById("preview-payment-method").innerText = paymentMethod;
    document.getElementById("preview-total-amount").innerText = `K ${totalPrice.toFixed(2)}`;

    document.getElementById("order-preview-modal").style.display = "flex";
    document.getElementById("order-preview-overlay").style.display = "block";
}

function closeOrderPreview() {
    document.getElementById("order-preview-modal").style.display = "none";
    document.getElementById("order-preview-overlay").style.display = "none";
}

async function executeFinalOrderSubmission() {
    closeOrderPreview();

    try {
        const btn = document.getElementById("checkout-btn");
        btn.innerText = "⏳ Submitting Order...";
        btn.disabled = true;

        const items = Object.values(cart);
        const totalPrice = items.reduce((sum, item) => {
            const p = item.product.deal_price ? item.product.deal_price : item.product.price;
            return sum + (parseFloat(p) * item.qty);
        }, 0);

        const contactPhone = document.getElementById("customer-phone").value.trim();
        const cTitle = document.getElementById("customer-title").value;
        const cFirstName = document.getElementById("customer-first-name").value.trim();
        const cLastName = document.getElementById("customer-last-name").value.trim();
        const selectedOffice = document.getElementById("workplace-select").value;
        
        const paymentMethodSelect = document.getElementById("payment-method-select");
        const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : "Cash on Delivery";

        const initialPaymentStatus = paymentMethod === 'Cash on Delivery' ? 'Pending Collection' : 'Pending Gateway';

        const { error: custError } = await db.from('customers').upsert([{
            phone_number: contactPhone,
            title: cTitle,
            first_name: cFirstName,
            last_name: cLastName,
            default_office: selectedOffice,
            last_order_at: new Date().toISOString()
        }], { onConflict: 'phone_number' });

        if (custError) throw new Error("Customers Table Error: " + custError.message);

        // 1. Insert Order
        const { data: newOrder, error: orderError } = await db.from('orders').insert([{
            customer_phone: contactPhone,
            delivery_location: selectedOffice,
            total_amount: totalPrice,
            order_items_json: items,
            payment_method: paymentMethod,
            payment_status: initialPaymentStatus,
            fulfillment_status: 'Order Placed',
            status: 'Pending Aggregation'
        }]).select().single();

        if (orderError) throw new Error("Orders Table Error: " + orderError.message);

        // 2. Automatically Save / Link Custom Customer Combo (Duplicate Prevented)
        await saveCustomerCustomCombo(contactPhone, items);

        // Instantly reload custom combos on screen
        loadCustomerCustomCombos(contactPhone);

        localStorage.setItem("padesk_phone", contactPhone);
        localStorage.setItem("padesk_title", cTitle);
        localStorage.setItem("padesk_first_name", cFirstName);
        localStorage.setItem("padesk_last_name", cLastName);
        localStorage.setItem("padesk_office", selectedOffice);

        cart = {};
        updateCartUI();
        autoPopulateSavedCustomer();
        
        const displayOrderNo = newOrder && newOrder.order_number ? newOrder.order_number : "Successfully";
        alert(`Zikomo ${cTitle} ${cLastName || cFirstName}! Order ${displayOrderNo} has been placed via ${paymentMethod}. Your custom combo has been saved for easy reordering!`);

    } catch (error) {
        console.error(error);
        alert("Action Failed:\n" + error.message);
        updateCartUI();
    }
}

// 14. SMART CUSTOM COMBO SAVER WITH DUPLICATE PREVENTION
async function saveCustomerCustomCombo(phone, items) {
    try {
        const signatureParts = items.map(i => `${i.product.id}:${i.qty}`).sort();
        const productSignature = signatureParts.join(',');

        const { data: existingCombos } = await db
            .from('customer_combos')
            .select('id')
            .eq('customer_phone', phone)
            .eq('product_signature', productSignature);

        if (existingCombos && existingCombos.length > 0) {
            return;
        }

        const topBrands = [...new Set(items.map(i => i.product.brand).filter(Boolean))];
        const comboName = topBrands.length > 0 
            ? `${topBrands.slice(0, 2).join(' & ')} Office Bundle` 
            : `Custom Office Combo #${Math.floor(Math.random() * 900) + 100}`;

        await db.from('customer_combos').insert([{
            customer_phone: phone,
            combo_name: comboName,
            items_json: items,
            product_signature: productSignature
        }]);
    } catch (err) {
        console.error("Error saving custom combo template:", err);
    }
}
