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

// 6. ACCOUNT DETAILS DRAWER TOGGLE & BULLETPROOF HISTORY FETCH
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
        historyList.style.cssText = "border:none !important; background:transparent !important; box-shadow:none !important; padding:0 !important;";
        historyList.innerHTML = "<p style='color:#718096; font-size:0.85rem;'><small>No active session found.</small></p>";
    }
    if (signOutBtn) {
        signOutBtn.style.display = "none";
    }
}

// Attach globally to ensure onclick works
window.toggleCustomerOrderDetails = function(orderId) {
    const detailBox = document.getElementById(`cust-order-details-${orderId}`);
    if (detailBox) {
        detailBox.style.display = detailBox.style.display === 'none' ? 'block' : 'none';
    }
};

async function loadAccountHistory(phone) {
    const profileBox = document.getElementById("account-profile-info");
    const historyList = document.getElementById("account-order-history");
    const signOutBtn = document.getElementById("drawer-signout-btn");

    if (!historyList) return;

    // Immediately show loading state and strip conflicting global CSS
    historyList.style.cssText = "border:none !important; background:transparent !important; box-shadow:none !important; padding:0 !important;";
    historyList.innerHTML = '<div style="padding: 20px; text-align: center; color: #718096; font-family: sans-serif;">⏳ Loading orders...</div>';

    const savedTitle = localStorage.getItem("padesk_title") || "";
    const savedFirstName = localStorage.getItem("padesk_first_name") || "Shopper";
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

    try {
        const { data: orders, error } = await db
            .from('orders')
            .select('*')
            .eq('customer_phone', phone)
            .order('id', { ascending: false });

        if (error) throw error;

        if (!orders || orders.length === 0) {
            historyList.innerHTML = '<div style="padding: 20px; text-align: center; color: #718096;">No past orders found.</div>';
            return;
        }

        historyList.innerHTML = orders.map(o => {
            const orderDate = o.created_at ? new Date(o.created_at).toLocaleDateString() : '-';
            const orderNum = o.order_number || (`#ORD-${o.id}`);
            const status = o.fulfillment_status || 'Order Placed';
            const items = o.order_items_json || [];
            const total = parseFloat(o.total_amount || 0).toFixed(2);
            
            const color = status === 'Delivered' ? '#0baf65' : (status === 'Cancelled' ? '#e53e3e' : '#3182ce');

            // Generate items carefully without tables
            let itemsHtml = items.map(item => {
                const pName = (item.product && item.product.name) ? item.product.name : 'Item';
                const pPrice = item.product ? parseFloat(item.product.deal_price || item.product.price || 0) : 0;
                return `
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; border-bottom: 1px solid #edf2f7; padding: 6px 0; color: #2d3748;">
                        <span>${item.qty || 1}x ${pName}</span>
                        <strong style="color: #0baf65;">K ${(pPrice * (item.qty || 1)).toFixed(2)}</strong>
                    </div>
                `;
            }).join('');

            return `
                <div style="background: white; border: 1px solid #cbd5e0; border-radius: 8px; padding: 12px; margin-bottom: 10px; font-family: sans-serif; display: block; width: 100%; box-sizing: border-box; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div onclick="window.toggleCustomerOrderDetails(${o.id})" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                        <div>
                            <div style="font-weight: bold; color: #2d3748; font-size: 0.9rem;">${orderNum}</div>
                            <div style="font-size: 0.75rem; color: #718096;">${orderDate} • <span style="color:${color}; font-weight:bold;">${status}</span></div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: bold; color: #0baf65; font-size: 0.9rem;">K ${total}</div>
                            <div style="font-size: 0.7rem; color: #a0aec0;">Tap view ▾</div>
                        </div>
                    </div>

                    <div id="cust-order-details-${o.id}" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                        <div style="font-size: 0.75rem; color: #4a5568; margin-bottom: 8px; line-height: 1.4;">
                            📍 <strong>Delivery:</strong> ${o.delivery_location || '-'}<br>
                            💳 <strong>Payment:</strong> ${o.payment_method || 'CoD'}
                        </div>
                        <div style="font-weight: bold; font-size: 0.75rem; color: #4a5568; margin-bottom: 4px;">📦 Ordered Items:</div>
                        ${itemsHtml}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        historyList.innerHTML = `<div style="color: #e53e3e; padding: 10px; font-size: 0.8rem; background: #fff5f5; border: 1px solid #feb2b2; border-radius: 6px;"><strong>Error loading orders:</strong> ${err.message}</div>`;
    }
}
function openFullOrderHistory() {
    const phone = localStorage.getItem("padesk_phone");
    if (!phone) {
        alert("Please sign in or enter your phone number first.");
        return;
    }
    window.location.href = "my-orders.html";
}
// 7. READY-MADE ADMIN COMBO BANNERS SLIDER
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
                const stockQty = product.stock_qty || 0;
                const sellOos = product.sell_oos || 'N';

                if (stockQty <= 0 && sellOos !== 'Y') {
                    console.warn(`Skipping out-of-stock product "${product.name}" in combo.`);
                    return;
                }

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
        const slideWidth = container.clientWidth; // Takes exact 100% container width
        container.scrollTo({ left: slideWidth * currentSlide, behavior: 'smooth' });
    }, 4000);
}

function syncDotsOnScroll(totalSlides) {
    const container = document.getElementById("banner-carousel");
    if (!container) return;

    const slideWidth = container.clientWidth;
    const activeIdx = Math.round(container.scrollLeft / slideWidth);

    for (let i = 0; i < totalSlides; i++) {
        const dot = document.getElementById(`dot-${i}`);
        if (dot) dot.classList.toggle('active', i === activeIdx);
    }
}

// 8. FETCH PRODUCTS FROM DATABASE MASTER
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

// 9. HIERARCHICAL DRILL-DOWN FILTERS (LOCAL WORKSPACE IMAGES FOR BUSINESS & CATEGORY)
function buildDynamicMasterFilters() {
    const rawBusinesses = [...new Set(allProducts.map(p => p.business).filter(Boolean))];
    const businesses = ['ALL', ...rawBusinesses.filter(b => b.toLowerCase() !== 'groceries' || b === 'Grocery')];

    const businessCircles = document.getElementById("business-circles");
    
    const businessImages = {
        'Grocery': 'images/business/grocery.png',
        'grocery': 'images/business/grocery.png',
        'Health & Beauty': 'images/business/beauty.png',
        'Stationery': 'images/business/stationery.png',
        'Electronics': 'images/business/electronics.png'
    };

    if (businessCircles) {
        businessCircles.innerHTML = businesses.map((bus, idx) => {
            const isAll = bus === 'ALL';
            const bgImg = businessImages[bus] || businessImages[bus.toLowerCase()];

            if (isAll || !bgImg) {
                return `
                    <div class="circle-item ${idx === 0 ? 'active' : ''}" onclick="selectBusinessCircle('${bus}', this)">
                        <div class="circle-icon" style="background: linear-gradient(135deg, #f7fafc, #edf2f7); border: 2px solid ${idx === 0 ? '#0baf65' : '#e2e8f0'}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">📦</div>
                        <span>${bus}</span>
                    </div>
                `;
            } else {
                return `
                    <div class="circle-item ${idx === 0 ? 'active' : ''}" onclick="selectBusinessCircle('${bus}', this)">
                        <div class="circle-icon" style="background-image: url('${bgImg}'); background-size: cover; background-position: center; border: 2px solid ${idx === 0 ? '#0baf65' : '#e2e8f0'};"></div>
                        <span>${bus}</span>
                    </div>
                `;
            }
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

        const categoryImages = {
            'Food': 'images/category/food.png',
            'Home Care': 'images/category/home-care.png',
            'School': 'images/category/school.png'
        };

        if (categories.length > 1) {
            catCirclesContainer.style.display = 'flex';
            catCirclesContainer.innerHTML = categories.map((cat, idx) => {
                const isAll = cat === 'ALL';
                const catKey = cat;
                const catImg = categoryImages[catKey];

                if (isAll || !catImg) {
                    return `
                        <div class="circle-item ${idx === 0 ? 'active' : ''}" onclick="selectCategoryCircle('${businessName}', '${cat}', this)">
                            <div class="circle-icon" style="width:48px; height:48px; background: linear-gradient(135deg, #f7fafc, #edf2f7); border: 2px solid ${idx === 0 ? '#0baf65' : '#cbd5e0'}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">📦</div>
                            <span style="font-size:0.68rem;">${cat}</span>
                        </div>
                    `;
                } else {
                    return `
                        <div class="circle-item ${idx === 0 ? 'active' : ''}" onclick="selectCategoryCircle('${businessName}', '${cat}', this)">
                            <div class="circle-icon" style="width:48px; height:48px; background-image: url('${catImg}'); background-size: cover; background-position: center; border: 2px solid ${idx === 0 ? '#0baf65' : '#cbd5e0'}; box-shadow: 0 2px 4px rgba(0,0,0,0.03);"></div>
                            <span style="font-size:0.68rem;">${cat}</span>
                        </div>
                    `;
                }
            }).join('');
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

// 10. UNIVERSAL SEARCH & HIERARCHICAL FILTER ENGINE
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
        const stockQty = p.stock_qty || 0;
        const sellOos = p.sell_oos || 'N';
        const isOutOfStock = stockQty <= 0 && sellOos !== 'Y';

        return `
            <div class="product-card" style="${isOutOfStock ? 'opacity: 0.65; background: #f7fafc;' : ''}">
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
                    ${isOutOfStock 
                        ? `<button class="btn-add" disabled style="background: #cbd5e0; color: #718096; cursor: not-allowed;">Out of Stock</button>`
                        : `<button onclick='addToCart(${JSON.stringify(p)}, event)' class="btn-add">+ Add</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

// 11. QUANTITY BASKET & COMBO ENGINE
function addToCart(product, event) {
    const stockQty = product.stock_qty || 0;
    const sellOos = product.sell_oos || 'N';

    if (stockQty <= 0 && sellOos !== 'Y') {
        alert(`Sorry, "${product.name}" is currently out of stock.`);
        return;
    }

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

// 12. CHECKOUT PREVIEW MODAL FLOW
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
        if (btn) {
            btn.innerText = "⏳ Submitting Order...";
            btn.disabled = true;
        }

        const items = Object.values(cart);
        const totalPrice = items.reduce((sum, item) => {
            const p = item.product.deal_price ? item.product.deal_price : item.product.price;
            return sum + (parseFloat(p) * item.qty);
        }, 0);

        // 1. FINANCE HEAD GUARDRAIL: Check Selling Price vs Cost Price & Stock Availability (with sell_oos check)
        for (const item of items) {
            const prodId = item.product.id;
            const orderQty = item.qty;
            const effectivePrice = parseFloat(item.product.deal_price || item.product.price || 0);
            const itemCost = parseFloat(item.product.cost_price || 0);

            // Guardrail A: Zero Selling Below Cost (Internal block, friendly customer message)
if (effectivePrice < itemCost) {
    throw new Error(`We are currently updating pricing for "${item.product.name}". Please remove it from your cart or contact support to proceed.`);
}

            // Guardrail B: Stock Availability Check with sell_oos override
            const { data: liveProd, error: stockCheckErr } = await db.from('products').select('stock_qty, name, sell_oos').eq('id', prodId).single();
            if (stockCheckErr || !liveProd) throw new Error(`Could not verify stock for ${item.product.name}`);

            const currentStock = liveProd.stock_qty || 0;
            const sellOos = liveProd.sell_oos || 'N';

            if (currentStock < orderQty) {
                if (sellOos === 'Y') {
                    // Allowed to go negative per sell_oos override
                    console.log(`Allowing OOS sale for "${liveProd.name}". Stock will drop into negative values.`);
                } else {
                    throw new Error(`Insufficient stock for "${liveProd.name}". Only ${currentStock} units available.`);
                }
            }
        }

        const contactPhone = document.getElementById("customer-phone").value.trim();
        const cTitle = document.getElementById("customer-title").value;
        const cFirstName = document.getElementById("customer-first-name").value.trim();
        const cLastName = document.getElementById("customer-last-name").value.trim();
        const selectedOffice = document.getElementById("workplace-select").value;
        
        const paymentMethodSelect = document.getElementById("payment-method-select");
        const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : "Cash on Delivery";
        const initialPaymentStatus = paymentMethod === 'Cash on Delivery' ? 'Pending Collection' : 'Pending Gateway';

        // Upsert Customer Record
        await db.from('customers').upsert([{
            phone_number: contactPhone,
            title: cTitle,
            first_name: cFirstName,
            last_name: cLastName,
            default_office: selectedOffice,
            last_order_at: new Date().toISOString()
        }], { onConflict: 'phone_number' });

        // 2. Insert Order
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

        // 3. AUTOMATED INVENTORY DEDUCTION (Deduct stock, allowing negative stock if sell_oos is 'Y')
        for (const item of items) {
            const prodId = item.product.id;
            const orderQty = item.qty;

            // Fetch latest stock to prevent race conditions
            const { data: currentP } = await db.from('products').select('stock_qty').eq('id', prodId).single();
            const updatedStock = (currentP.stock_qty || 0) - orderQty; // Permits negative values

            await db.from('products').update({ stock_qty: updatedStock }).eq('id', prodId);
        }

        // Save Custom Combo Template & Reset Cart
        await saveCustomerCustomCombo(contactPhone, items);
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

        // The order is already saved and stock already deducted at this point.
        // Rendering the confirmation view is display-only — its failure must
        // never be reported to the customer as an order/submission failure.
        try {
            showOrderConfirmation({
                orderNo: displayOrderNo,
                title: cTitle,
                lastName: cLastName,
                firstName: cFirstName,
                office: selectedOffice,
                paymentMethod: paymentMethod,
                paymentStatus: initialPaymentStatus,
                items: items,
                total: totalPrice
            });
        } catch (renderError) {
            console.error("Order succeeded but confirmation view failed to render:", renderError);
            alert(`Zikomo ${cTitle} ${cLastName || cFirstName}! Order ${displayOrderNo} has been placed and is being prepared for delivery.`);
        }

    } catch (error) {
        console.error(error);
        alert("Order Submission Blocked:\n" + error.message);
        updateCartUI();
    }
}

// Computes the next upcoming delivery day (Tuesdays & Thursdays), formatted for display
function getNextDeliveryDayLabel() {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date();
    for (let offset = 0; offset <= 7; offset++) {
        const d = new Date(today);
        d.setDate(today.getDate() + offset);
        if (d.getDay() === 2 || d.getDay() === 4) { // Tue=2, Thu=4
            const label = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : `${dayNames[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
            return label;
        }
    }
    return "Tue or Thu";
}

// Safely sets text on an element if it exists; no-op (with a console warning) otherwise
function setTextSafe(id, value) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`showOrderConfirmation: element #${id} not found in DOM — is index.html up to date?`);
        return;
    }
    el.innerText = value;
}

// Renders the full-screen order confirmation view in place of the alert()
function showOrderConfirmation(order) {
    setTextSafe("confirmation-greeting", `Zikomo ${order.title} ${order.lastName || order.firstName}! We've received your order and it's being prepared for delivery.`);
    setTextSafe("confirmation-order-no", order.orderNo);
    setTextSafe("confirmation-office", order.office);
    setTextSafe("confirmation-delivery-day", getNextDeliveryDayLabel());
    setTextSafe("confirmation-payment", `${order.paymentMethod} — ${order.paymentStatus}`);
    setTextSafe("confirmation-total", `K ${order.total.toFixed(2)}`);

    const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

    const itemsList = document.getElementById("confirmation-items-list");
    if (itemsList) {
        itemsList.innerHTML = order.items.map(item => {
            const price = parseFloat(item.product.deal_price || item.product.price || 0);
            return `<li><span>${escapeHtml(item.product.name)} x${item.qty}</span><span>K ${(price * item.qty).toFixed(2)}</span></li>`;
        }).join("");
    }

    const viewEl = document.getElementById("order-confirmation-view");
    if (!viewEl) {
        throw new Error("Confirmation view container (#order-confirmation-view) not found — falling back to alert.");
    }
    viewEl.style.display = "block";
    window.scrollTo(0, 0);
}

// Dismisses the confirmation view and returns to the product grid
function backToStore() {
    document.getElementById("order-confirmation-view").style.display = "none";
    window.scrollTo(0, 0);
}

// 13. SMART CUSTOM COMBO SAVER WITH DUPLICATE PREVENTION
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
