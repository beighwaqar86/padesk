const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";

const MIN_ITEMS = 3;
const MIN_TOTAL = 249.00;
const CART_STORAGE_KEY = "padesk_cart";
const PRODUCTS_PAGE_SIZE = 30;

let db;
let allProducts = [];
let productsById = {};       // live catalog, keyed by id — always the freshest price/stock
let historicalProductsById = {}; // fallback snapshots from past orders, for products no longer active
let accountOrdersById = {};  // populated when the account drawer's order history loads
let cart = {};
let currentSlide = 0;
let slideInterval;
let currentFilteredProducts = []; // the active filtered/sorted list, for "Load More" paging
let productsRenderedCount = 0;
let currentSort = "default";
let bannersById = {};   // for combo conversion tracking
let combosById = {};    // for combo conversion tracking
let cartComboSources = new Set(); // "banner:12" / "combo:7" — which combos contributed to the current cart

// Effective selling price for a product (deal price wins if set)
function getPrice(product) {
    return parseFloat(product.deal_price || product.price || 0);
}

// Aggregate count + total for a set of cart items ({ product, qty })
function getCartTotals(items) {
    return items.reduce((acc, item) => {
        acc.count += item.qty;
        acc.total += getPrice(item.product) * item.qty;
        return acc;
    }, { count: 0, total: 0 });
}

// Looks up a product by id, preferring the live catalog over a historical snapshot
function getProductById(id) {
    return productsById[id] || historicalProductsById[id] || null;
}

window.onload = function() {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    loadCartFromStorage();
    loadBanners();
    loadProducts();
    autoPopulateSavedCustomer();
    renderSavedOfficeChips();
    setupScrollToTopButton();
};

// Opens/closes the cart drawer. Pass true to force it open (e.g. after adding a combo).
function toggleCartDrawer(forceOpen) {
    const drawer = document.getElementById("cart-section");
    const overlay = document.getElementById("cart-drawer-overlay");
    if (!drawer || !overlay) return;

    const shouldOpen = forceOpen === true ? true : !drawer.classList.contains("open");
    drawer.classList.toggle("open", shouldOpen);
    overlay.style.display = shouldOpen ? "block" : "none";
}

// Kept for any older callers — now opens the cart drawer instead of scrolling
function scrollToCartSection() {
    toggleCartDrawer(true);
}

const SAVED_OFFICES_KEY = "padesk_saved_offices";

// Returns the list of offices the customer has starred for quick reuse
function getSavedOffices() {
    try {
        return JSON.parse(localStorage.getItem(SAVED_OFFICES_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveOfficeToQuickList(officeName) {
    if (!officeName) return;
    const offices = getSavedOffices();
    if (!offices.includes(officeName)) {
        offices.push(officeName);
        localStorage.setItem(SAVED_OFFICES_KEY, JSON.stringify(offices));
        renderSavedOfficeChips();
    }
}

function removeSavedOffice(officeName) {
    const offices = getSavedOffices().filter(o => o !== officeName);
    localStorage.setItem(SAVED_OFFICES_KEY, JSON.stringify(offices));
    renderSavedOfficeChips();
}

function selectSavedOffice(officeName) {
    const select = document.getElementById("workplace-select");
    if (select) select.value = officeName;
}

// Renders quick-pick chips for previously saved offices above the delivery point select
function renderSavedOfficeChips() {
    const container = document.getElementById("saved-offices-chips");
    if (!container) return;

    const offices = getSavedOffices();
    if (offices.length === 0) {
        container.innerHTML = "";
        container.style.display = "none";
        return;
    }

    container.style.display = "flex";
    container.innerHTML = offices.map(o => `
        <span onclick="selectSavedOffice('${o.replace(/'/g, "\\'")}')" style="display: inline-flex; align-items: center; gap: 4px; background: #e6f7f0; color: #088a4f; font-size: 0.72rem; font-weight: 600; padding: 4px 8px; border-radius: 12px; cursor: pointer; white-space: nowrap;">
            📍 ${o}
            <span onclick="event.stopPropagation(); removeSavedOffice('${o.replace(/'/g, "\\'")}')" style="color: #a0aec0; font-weight: bold; margin-left: 2px;">✕</span>
        </span>
    `).join('');
}

// Shows a floating "back to top" button once the user has scrolled down a bit
function setupScrollToTopButton() {
    const btn = document.getElementById("scroll-top-btn");
    if (!btn) return;
    window.addEventListener('scroll', () => {
        btn.style.display = window.scrollY > 600 ? "flex" : "none";
    });
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            if (p && !historicalProductsById[p.id]) historicalProductsById[p.id] = p;
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
                    <div class="price" style="font-size:0.8rem; margin:2px 0;">K ${getPrice(p).toFixed(2)}</div>
                </div>
                <button onclick="addToCartById(${p.id}, event)" class="btn-add" style="padding:4px 8px; font-size:0.75rem;">+ Add to Combo</button>
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
            combosById[c.id] = c;
            const encodedItems = encodeURIComponent(JSON.stringify(c.items_json));
            return `
                <div class="past-card" style="min-width: 180px; background: #e6f7f0; border-color: #b2f5ea;">
                    <div>
                        <span class="brand-tag" style="color: #088a4f;">Saved Combo</span>
                        <h5 style="margin: 4px 0; font-size: 0.85rem;">${c.combo_name}</h5>
                        <small style="color: #718096; font-size: 0.7rem;">${(c.items_json || []).length} items included</small>
                    </div>
                    <button type="button" onclick="addBannerComboToCart('${encodedItems}', '${c.combo_name}', 'combo', ${c.id})" class="btn-add" style="margin-top: 8px; padding: 4px 8px; font-size: 0.75rem; background: #0baf65;">+ Add Combo</button>
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
            accountOrdersById[o.id] = o;
            const orderDate = o.created_at ? new Date(o.created_at).toLocaleDateString() : '-';
            const orderNum = o.order_number || (`#ORD-${o.id}`);
            const status = o.fulfillment_status || 'Order Placed';
            const items = o.order_items_json || [];
            const total = parseFloat(o.total_amount || 0).toFixed(2);
            
            const color = status === 'Delivered' ? '#0baf65' : (status === 'Cancelled' ? '#e53e3e' : '#3182ce');
            const isCancellable = status === 'Order Placed';

            // Generate items carefully without tables
            let itemsHtml = items.map(item => {
                const pName = (item.product && item.product.name) ? item.product.name : 'Item';
                const pPrice = item.product ? getPrice(item.product) : 0;
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
                        <button type="button" onclick="reorderPastOrder(${o.id})" style="margin-top: 10px; width: 100%; background: #0baf65; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: bold; font-size: 0.78rem; cursor: pointer;">🔁 Reorder These Items</button>
                        ${isCancellable ? `<button type="button" onclick="cancelOrder(${o.id})" style="margin-top: 8px; width: 100%; background: white; color: #e53e3e; border: 1px solid #e53e3e; padding: 8px; border-radius: 6px; font-weight: bold; font-size: 0.78rem; cursor: pointer;">Cancel Order</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        historyList.innerHTML = `<div style="color: #e53e3e; padding: 10px; font-size: 0.8rem; background: #fff5f5; border: 1px solid #feb2b2; border-radius: 6px;"><strong>Error loading orders:</strong> ${err.message}</div>`;
    }
}
// Cancels an order while it's still in the "Order Placed" window and restores
// the stock that was deducted at checkout.
async function cancelOrder(orderId) {
    const order = accountOrdersById[orderId];
    if (!order) {
        alert("Sorry, that order's details are no longer available.");
        return;
    }

    const orderLabel = order.order_number || `#ORD-${order.id}`;
    const confirmed = confirm(`Cancel order ${orderLabel}? This can't be undone, and you'll need to place a new order if you change your mind.`);
    if (!confirmed) return;

    try {
        const { error: updateErr } = await db
            .from('orders')
            .update({ fulfillment_status: 'Cancelled', status: 'Cancelled' })
            .eq('id', orderId)
            .eq('fulfillment_status', 'Order Placed'); // guard against cancelling an order ops has already moved on

        if (updateErr) throw updateErr;

        // Restore stock for each item (best-effort; mirrors the deduction at checkout)
        const items = order.order_items_json || [];
        const restoreFailures = [];
        for (const item of items) {
            const prodId = item.product && item.product.id;
            if (!prodId) continue;
            const { data: currentP } = await db.from('products').select('stock_qty').eq('id', prodId).single();
            const restoredStock = ((currentP && currentP.stock_qty) || 0) + (item.qty || 1);
            const { error: restoreErr } = await db.from('products').update({ stock_qty: restoredStock }).eq('id', prodId);
            if (restoreErr) {
                console.error(`Could not restore stock for "${item.product.name}":`, restoreErr);
                restoreFailures.push(item.product.name);
            }
        }

        // Mark this order's stock as restored so it's never restored a second
        // time, even if an admin later flips its status around.
        if (restoreFailures.length === 0) {
            await db.from('orders').update({ stock_restored: true }).eq('id', orderId);
        }

        alert(`Order ${orderLabel} has been cancelled.` + (restoreFailures.length > 0 ? `\n\nNote: stock for ${restoreFailures.join(", ")} could not be automatically restored — please adjust it manually if needed.` : ''));
        const phone = localStorage.getItem("padesk_phone");
        if (phone) loadAccountHistory(phone);
        loadProducts(); // refresh catalog so restored stock is reflected immediately
        const confirmationView = document.getElementById("order-confirmation-view");
        if (confirmationView && confirmationView.style.display !== "none") backToStore();
    } catch (err) {
        console.error("Error cancelling order:", err);
        alert("Sorry, we couldn't cancel this order — it may have already moved into preparation. Please contact support.");
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
// Re-adds every item from a past order to the current cart, preferring live
// product data (current price/stock) over the snapshot stored on the order.
function reorderPastOrder(orderId) {
    const order = accountOrdersById[orderId];
    if (!order) {
        alert("Sorry, that order's details are no longer available.");
        return;
    }

    const items = order.order_items_json || [];
    let addedCount = 0;
    let skipped = [];

    items.forEach(item => {
        const snapshotProduct = item.product;
        if (!snapshotProduct || !snapshotProduct.id) return;

        const liveProduct = getProductById(snapshotProduct.id) || snapshotProduct;
        const stockQty = liveProduct.stock_qty || 0;
        const sellOos = liveProduct.sell_oos || 'N';

        if (stockQty <= 0 && sellOos !== 'Y') {
            skipped.push(liveProduct.name);
            return;
        }

        if (cart[liveProduct.id]) {
            cart[liveProduct.id].qty += (item.qty || 1);
        } else {
            cart[liveProduct.id] = { product: liveProduct, qty: item.qty || 1 };
        }
        addedCount++;
    });

    updateCartUI();
    toggleAccountDrawer();
    scrollToCartSection();

    const orderLabel = order.order_number || `#ORD-${order.id}`;
    let msg = `Added ${addedCount} item(s) from order ${orderLabel} to your cart.`;
    if (skipped.length > 0) msg += ` Currently unavailable and skipped: ${skipped.join(", ")}.`;
    alert(msg);
}

// 7. READY-MADE ADMIN COMBO BANNERS SLIDER
async function loadBanners() {
    const { data: banners } = await db.from('banners').select('*').eq('is_active', true);
    if (!banners || banners.length === 0) return;

    const container = document.getElementById("banner-carousel");
    const dotsContainer = document.getElementById("slider-dots");

    if (container) {
        container.innerHTML = banners.map(b => {
            bannersById[b.id] = b;
            const encodedItems = b.items_json ? encodeURIComponent(JSON.stringify(b.items_json)) : '';
            const comboTitle = b.title || 'Combo';

            return `
                <div class="banner-card" style="background-image: url('${b.image_url}'); position: relative;">
                    ${b.items_json ? `
                        <button type="button" onclick="addBannerComboToCart('${encodedItems}', '${comboTitle}', 'banner', ${b.id})" class="btn-add-combo" style="position: absolute; top: 10px; right: 10px; background: #0baf65; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index: 5;">
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

function addBannerComboToCart(encodedItems, comboTitle, sourceType, sourceId) {
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

        if (sourceType && sourceId) {
            trackComboAdded(sourceType, sourceId);
            cartComboSources.add(`${sourceType}:${sourceId}`);
        }

        updateCartUI();
        alert(`⚡ "${comboTitle}" added to your cart successfully! Check your minimum combo criteria below.`);
    } catch (e) {
        console.error("Error adding combo:", e);
        alert("Could not process this combo items list.");
    }
}

// Fire-and-forget: increments times_added for a banner or saved combo.
// Never blocks the UI and never surfaces an error to the customer — this is
// an internal analytics counter, not something that should interrupt shopping.
async function trackComboAdded(sourceType, sourceId) {
    try {
        const table = sourceType === 'banner' ? 'banners' : 'customer_combos';
        const cache = sourceType === 'banner' ? bannersById : combosById;
        const current = cache[sourceId];
        const newCount = ((current && current.times_added) || 0) + 1;

        await db.from(table).update({ times_added: newCount }).eq('id', sourceId);
        if (current) current.times_added = newCount;
    } catch (err) {
        console.warn("Could not record combo-added tracking (non-critical):", err);
    }
}

// Fire-and-forget: increments times_ordered for every combo that contributed
// items to a cart which just became a successful order. Called once per
// checkout, after the order is confirmed.
async function trackComboOrdersConverted() {
    if (cartComboSources.size === 0) return;

    for (const key of cartComboSources) {
        const [sourceType, sourceIdStr] = key.split(':');
        const sourceId = parseInt(sourceIdStr, 10);
        try {
            const table = sourceType === 'banner' ? 'banners' : 'customer_combos';
            const cache = sourceType === 'banner' ? bannersById : combosById;
            const current = cache[sourceId];
            const newCount = ((current && current.times_ordered) || 0) + 1;

            await db.from(table).update({ times_ordered: newCount }).eq('id', sourceId);
            if (current) current.times_ordered = newCount;
        } catch (err) {
            console.warn("Could not record combo-ordered tracking (non-critical):", err);
        }
    }
    cartComboSources.clear();
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
    productsById = {};
    allProducts.forEach(p => { productsById[p.id] = p; });

    refreshCartWithLiveData();
    buildDynamicMasterFilters();
    renderProducts(allProducts, true);
}

// Cart items are persisted with a snapshot of the product at add-time. Once the
// live catalog has loaded, swap in the current product data (price/stock/deal)
// wherever available so a restored cart never shows stale prices.
function refreshCartWithLiveData() {
    let changed = false;
    Object.keys(cart).forEach(id => {
        const live = productsById[id];
        if (live) {
            cart[id].product = live;
            changed = true;
        }
    });
    if (changed) updateCartUI();
}

// Persists the cart so a page refresh or accidental close doesn't lose it
function saveCartToStorage() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
        console.warn("Could not persist cart:", e);
    }
}

// Restores a previously saved cart on load (called before products finish loading;
// refreshCartWithLiveData() then swaps in live product data once available)
function loadCartFromStorage() {
    try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        if (saved) cart = JSON.parse(saved) || {};
    } catch (e) {
        console.warn("Could not restore saved cart:", e);
        cart = {};
    }
}

// 9. HIERARCHICAL DRILL-DOWN FILTERS (LOCAL WORKSPACE IMAGES FOR BUSINESS & CATEGORY)

// Curated display order confirmed against the real business_master values
// (Grocery, Health & Beauty, Baby, Confectionary, Stationary, Electronics).
// Anything not in this list (e.g. a brand-new business added later) still
// shows up — just appended after these, alphabetically.
const BUSINESS_DISPLAY_ORDER = ['Grocery', 'Health & Beauty', 'Baby', 'Confectionary', 'Stationary', 'Stationery', 'Electronics'];

function sortBusinessesByPriority(businesses) {
    return [...businesses].sort((a, b) => {
        const aRank = BUSINESS_DISPLAY_ORDER.indexOf(a);
        const bRank = BUSINESS_DISPLAY_ORDER.indexOf(b);
        const aScore = aRank === -1 ? BUSINESS_DISPLAY_ORDER.length : aRank;
        const bScore = bRank === -1 ? BUSINESS_DISPLAY_ORDER.length : bRank;
        if (aScore !== bScore) return aScore - bScore;
        return a.localeCompare(b);
    });
}

function buildDynamicMasterFilters() {
    const rawBusinesses = [...new Set(allProducts.map(p => p.business).filter(Boolean))];
    const businesses = ['ALL', ...sortBusinessesByPriority(rawBusinesses)];

    const businessCircles = document.getElementById("business-circles");
    
    // Keyed to match the real business_master values confirmed via the database:
    // Grocery, Health & Beauty, Baby, Confectionary, Stationary, Electronics —
    // with a couple of legacy aliases kept for any products tagged before this
    // naming was confirmed (e.g. older "Groceries"/"Stationery" spellings).
    const businessImages = {
        'Grocery': 'images/business/grocery.png',
        'Groceries': 'images/business/grocery.png',
        'Health & Beauty': 'images/business/beauty.png',
        'Beauty': 'images/business/beauty.png',
        'Stationary': 'images/business/stationery.png',
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

    filtered = applySortOrder(filtered);
    renderProducts(filtered, true);
}

// Sorts a product list according to the currently selected sort option
function applySortOrder(products) {
    const sorted = [...products];
    switch (currentSort) {
        case "price-asc":
            return sorted.sort((a, b) => getPrice(a) - getPrice(b));
        case "price-desc":
            return sorted.sort((a, b) => getPrice(b) - getPrice(a));
        case "in-stock":
            return sorted.sort((a, b) => {
                const aOos = (a.stock_qty || 0) <= 0 && (a.sell_oos || 'N') !== 'Y';
                const bOos = (b.stock_qty || 0) <= 0 && (b.sell_oos || 'N') !== 'Y';
                return aOos - bOos; // in-stock (false=0) first
            });
        case "name-asc":
            return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        default:
            return sorted;
    }
}

// Called when the sort dropdown changes
function handleSortChange(value) {
    currentSort = value;
    applyFilters();
}

// resetPaging=true starts back at page 1 (used whenever filters/search/sort change).
// Called with no second argument (e.g. from "Load More"), it appends the next page
// to whatever's already rendered.
function renderProducts(products, resetPaging) {
    const container = document.getElementById("product-list");

    if (resetPaging) {
        currentFilteredProducts = products;
        productsRenderedCount = 0;
        container.innerHTML = "";
    }

    if (currentFilteredProducts.length === 0) {
        container.innerHTML = "<p><small>No items match your search or filter.</small></p>";
        removeLoadMoreButton();
        return;
    }

    const nextBatch = currentFilteredProducts.slice(productsRenderedCount, productsRenderedCount + PRODUCTS_PAGE_SIZE);
    productsRenderedCount += nextBatch.length;

    const batchHtml = nextBatch.map(p => {
        const activePrice = getPrice(p);
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
                        K ${activePrice.toFixed(2)}
                        ${p.deal_price ? `<small style="text-decoration:line-through; color:#a0aec0; font-size:0.75rem;">K${parseFloat(p.price).toFixed(2)}</small>` : ''}
                    </div>
                    ${isOutOfStock 
                        ? `<button class="btn-add" onclick="notifyWhenBackInStock(${p.id})" style="background: #edf2f7; color: #4a5568; border: 1px solid #cbd5e0;">🔔 Notify Me</button>`
                        : `<button onclick="addToCartById(${p.id}, event)" class="btn-add">+ Add</button>`
                    }
                </div>
            </div>
        `;
    }).join('');

    container.insertAdjacentHTML('beforeend', batchHtml);
    renderLoadMoreButton();
}

function removeLoadMoreButton() {
    const existing = document.getElementById("load-more-products-btn");
    if (existing) existing.remove();
}

function renderLoadMoreButton() {
    removeLoadMoreButton();
    if (productsRenderedCount >= currentFilteredProducts.length) return;

    const remaining = currentFilteredProducts.length - productsRenderedCount;
    const btn = document.createElement("button");
    btn.id = "load-more-products-btn";
    btn.type = "button";
    btn.className = "btn-load-more";
    btn.innerText = `Load More (${remaining} more item${remaining === 1 ? '' : 's'})`;
    btn.onclick = () => renderProducts(currentFilteredProducts, false);

    const container = document.getElementById("product-list");
    container.insertAdjacentElement('afterend', btn);
}

// Resolves a product id to its object and delegates to addToCart — avoids ever
// embedding a full product object (with possibly unescaped quotes) into an
// onclick attribute string.
function addToCartById(productId, event) {
    const product = getProductById(productId);
    if (!product) {
        alert("Sorry, this item is no longer available.");
        return;
    }
    addToCart(product, event);
}

// Captures interest in an out-of-stock product so demand isn't silently lost.
// Requires a `stock_notifications` table — see the SQL provided alongside this feature.
async function notifyWhenBackInStock(productId) {
    const product = getProductById(productId);
    if (!product) return;

    let phone = localStorage.getItem("padesk_phone") || "";
    if (!phone) {
        phone = prompt(`We'll text you when "${product.name}" is back in stock. Enter your phone number:`) || "";
        phone = phone.trim();
        if (!phone) return;
    }

    try {
        const { error } = await db.from('stock_notifications').insert([{
            product_id: productId,
            phone_number: phone,
            notified: false
        }]);
        if (error) throw error;
        alert(`Got it! We'll let you know when "${product.name}" is back in stock.`);
    } catch (err) {
        console.error("Could not save stock notification request:", err);
        alert("Sorry, something went wrong saving your request. Please try again.");
    }
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

    const floatingBtn = document.getElementById("floating-cart-btn");
    if (floatingBtn) {
        floatingBtn.classList.add("pulse");
        setTimeout(() => floatingBtn.classList.remove("pulse"), 300);
    }
}

function updateQuantity(productId, change) {
    if (cart[productId]) {
        cart[productId].qty += change;
        if (cart[productId].qty <= 0) delete cart[productId];
    }
    updateCartUI();
}

function removeFromCart(productId) {
    delete cart[productId];
    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById("cart-items");
    const items = Object.values(cart);

    list.innerHTML = items.map(item => {
        const effectivePrice = getPrice(item.product);
        return `
            <li style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.85rem;">
                <div>
                    <strong>${item.product.name}</strong><br>
                    <small>K ${effectivePrice.toFixed(2)} x ${item.qty} = <strong>K ${(effectivePrice * item.qty).toFixed(2)}</strong></small>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button onclick="updateQuantity(${item.product.id}, -1)" style="background: #edf2f7; border: 1px solid #cbd5e0; border-radius: 4px; padding: 2px 8px; font-weight: bold; cursor: pointer;">-</button>
                    <span style="font-weight: bold;">${item.qty}</span>
                    <button onclick="updateQuantity(${item.product.id}, 1)" style="background: #0baf65; color: white; border: none; border-radius: 4px; padding: 2px 8px; font-weight: bold; cursor: pointer;">+</button>
                    <button onclick="removeFromCart(${item.product.id})" title="Remove item" style="background: none; border: none; color: #e53e3e; cursor: pointer; padding: 4px; display: flex; align-items: center;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                    </button>
                </div>
            </li>
        `;
    }).join('');

    const { count: totalCount, total: totalPrice } = getCartTotals(items);
    saveCartToStorage();

    const headerCartCountEl = document.getElementById("header-cart-count");
    if (headerCartCountEl) {
        headerCartCountEl.innerText = totalCount;
    }

    const floatingCartCountEl = document.getElementById("floating-cart-count");
    if (floatingCartCountEl) {
        floatingCartCountEl.innerText = totalCount;
    }

    const countRuleEl = document.getElementById("item-count-rule");
    const priceRuleEl = document.getElementById("price-rule");
    const checkoutBtn = document.getElementById("checkout-btn");

    const hasMinItems = totalCount >= MIN_ITEMS;
    const hasMinPrice = totalPrice >= MIN_TOTAL;

    if (countRuleEl) {
        countRuleEl.innerHTML = hasMinItems ? `✅ Total Items: ${totalCount} (Minimum Met)` : `❌ Total Items: ${totalCount} / ${MIN_ITEMS} min`;
        countRuleEl.style.color = hasMinItems ? "#088a4f" : "#e53e3e";
    }

    if (priceRuleEl) {
        priceRuleEl.innerHTML = hasMinPrice ? `✅ Total: K ${totalPrice.toFixed(2)} (Minimum Met)` : `❌ Total: K ${totalPrice.toFixed(2)} / K ${MIN_TOTAL.toFixed(2)} min`;
        priceRuleEl.style.color = hasMinPrice ? "#088a4f" : "#e53e3e";
    }

    if (checkoutBtn) {
        checkoutBtn.disabled = !(hasMinItems && hasMinPrice);
        checkoutBtn.innerText = (hasMinItems && hasMinPrice) 
            ? `Place Combo Order (K ${totalPrice.toFixed(2)})` 
            : `Build Min Combo (${MIN_ITEMS} Items & K${MIN_TOTAL.toFixed(0)}) to Order`;
    }

    renderComboNudge(hasMinItems, hasMinPrice, totalCount, totalPrice);
}

// Suggests a couple of cheap, in-stock items not already in the cart when the
// customer is close to (but hasn't yet met) the combo minimums.
function renderComboNudge(hasMinItems, hasMinPrice, totalCount, totalPrice) {
    const nudgeEl = document.getElementById("combo-nudge");
    if (!nudgeEl) return;

    const isClose = !(hasMinItems && hasMinPrice) &&
        (totalCount >= MIN_ITEMS - 1 || totalPrice >= MIN_TOTAL * 0.7) &&
        totalCount > 0;

    if (!isClose) {
        nudgeEl.style.display = "none";
        nudgeEl.innerHTML = "";
        return;
    }

    const suggestions = allProducts
        .filter(p => !cart[p.id] && (p.stock_qty || 0) > 0)
        .sort((a, b) => getPrice(a) - getPrice(b))
        .slice(0, 3);

    if (suggestions.length === 0) {
        nudgeEl.style.display = "none";
        return;
    }

    nudgeEl.style.display = "block";
    nudgeEl.innerHTML = `
        <div style="font-size: 0.78rem; font-weight: 700; color: #4a5568; margin-bottom: 6px;">Almost there! Add one of these to complete your combo:</div>
        <div style="display: flex; gap: 8px; overflow-x: auto;">
            ${suggestions.map(p => `
                <div style="flex: 0 0 auto; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; min-width: 110px; text-align: center;">
                    <div style="font-size: 0.72rem; font-weight: 600; color: #2d3748; margin-bottom: 2px;">${p.name}</div>
                    <div style="font-size: 0.72rem; color: #0baf65; font-weight: 700; margin-bottom: 6px;">K ${getPrice(p).toFixed(2)}</div>
                    <button onclick="addToCartById(${p.id}, event)" style="width: 100%; background: #0baf65; color: white; border: none; padding: 4px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; cursor: pointer;">+ Add</button>
                </div>
            `).join('')}
        </div>
    `;
}

// 12. CHECKOUT PREVIEW MODAL FLOW
function handleCheckout(event) {
    event.preventDefault();

    const items = Object.values(cart);
    const { count: totalCount, total: totalPrice } = getCartTotals(items);

    if (totalCount < MIN_ITEMS || totalPrice < MIN_TOTAL) {
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
        const effectivePrice = getPrice(item.product);
        return `
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 6px;">
                <span>${item.qty}x ${item.product.name}</span>
                <strong>K ${(effectivePrice * item.qty).toFixed(2)}</strong>
            </div>
        `;
    }).join('');

    document.getElementById("preview-payment-method").innerText = paymentMethod;
    document.getElementById("preview-total-amount").innerText = `K ${totalPrice.toFixed(2)}`;

    const deliveryDayEl = document.getElementById("preview-delivery-day");
    if (deliveryDayEl) deliveryDayEl.innerText = getNextDeliveryDayLabel();

    toggleCartDrawer(false);
    document.getElementById("order-preview-modal").style.display = "flex";
    document.getElementById("order-preview-overlay").style.display = "block";
}

function closeOrderPreview() {
    document.getElementById("order-preview-modal").style.display = "none";
    document.getElementById("order-preview-overlay").style.display = "none";
}

async function executeFinalOrderSubmission() {
    // Show the loading overlay in the same tick as closing the preview, so
    // there is never a moment where the plain homepage is visible with no
    // indication that anything is happening.
    const overlay = document.getElementById("order-submitting-overlay");
    if (overlay) overlay.style.display = "flex";
    closeOrderPreview();

    try {
        const items = Object.values(cart);
        const { total: totalPrice } = getCartTotals(items);

        const contactPhone = document.getElementById("customer-phone").value.trim();
        const cTitle = document.getElementById("customer-title").value;
        const cFirstName = document.getElementById("customer-first-name").value.trim();
        const cLastName = document.getElementById("customer-last-name").value.trim();
        const selectedOffice = document.getElementById("workplace-select").value;

        const paymentMethodSelect = document.getElementById("payment-method-select");
        const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : "Cash on Delivery";
        const initialPaymentStatus = paymentMethod === 'Cash on Delivery' ? 'Pending Collection' : 'Pending Gateway';

        const reminderCheckbox = document.getElementById("delivery-reminder-optin");
        const wantsReminder = reminderCheckbox ? reminderCheckbox.checked : false;

        // 1. FINANCE HEAD GUARDRAIL + customer profile save, run concurrently —
        // neither depends on the other's result, so there's no reason to wait
        // for one before starting the other.
        const [guardrailResults] = await Promise.all([
            Promise.all(items.map(item => checkItemGuardrail(item))),
            db.from('customers').upsert([{
                phone_number: contactPhone,
                title: cTitle,
                first_name: cFirstName,
                last_name: cLastName,
                default_office: selectedOffice,
                wants_delivery_reminder: wantsReminder,
                last_order_at: new Date().toISOString()
            }], { onConflict: 'phone_number' })
        ]);

        const firstFailure = guardrailResults.find(r => r.error);
        if (firstFailure) throw new Error(firstFailure.error);

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
        accountOrdersById[newOrder.id] = newOrder; // so cancelOrder() works immediately from the confirmation screen

        // 3. INVENTORY DEDUCTION + combo template save, run concurrently — again,
        // neither depends on the other. Stock updates across items also now run
        // in parallel with each other instead of one at a time.
        const [stockIssues] = await Promise.all([
            deductStockForItems(items),
            saveCustomerCustomCombo(contactPhone, items)
        ]);
        loadCustomerCustomCombos(contactPhone);

        if (stockIssues.length > 0) {
            await db.from('orders').update({ has_stock_issue: true }).eq('id', newOrder.id);
        }

        localStorage.setItem("padesk_phone", contactPhone);
        localStorage.setItem("padesk_title", cTitle);
        localStorage.setItem("padesk_first_name", cFirstName);
        localStorage.setItem("padesk_last_name", cLastName);
        localStorage.setItem("padesk_office", selectedOffice);

        cart = {};
        updateCartUI();
        autoPopulateSavedCustomer();
        trackComboOrdersConverted(); // fire-and-forget, doesn't block the confirmation screen
        
        const displayOrderNo = newOrder && newOrder.order_number ? newOrder.order_number : "Successfully";

        if (overlay) overlay.style.display = "none";

        // The order is already saved and stock already deducted at this point.
        // Rendering the confirmation view is display-only — its failure must
        // never be reported to the customer as an order/submission failure.
        try {
            showOrderConfirmation({
                orderId: newOrder ? newOrder.id : null,
                orderNo: displayOrderNo,
                title: cTitle,
                lastName: cLastName,
                firstName: cFirstName,
                office: selectedOffice,
                paymentMethod: paymentMethod,
                paymentStatus: initialPaymentStatus,
                items: items,
                total: totalPrice,
                stockIssues: stockIssues
            });
        } catch (renderError) {
            console.error("Order succeeded but confirmation view failed to render:", renderError);
            alert(`Zikomo ${cTitle} ${cLastName || cFirstName}! Order ${displayOrderNo} has been placed and is being prepared for delivery.`);
        }

    } catch (error) {
        if (overlay) overlay.style.display = "none";
        console.error(error);
        alert("Order Submission Blocked:\n" + error.message);
        updateCartUI();
    }
}

// Checks one cart item against the pricing and stock guardrails. Returns
// { error: null } if it's fine to sell, or { error: "..." } with a
// customer-friendly message if not. Designed to run in parallel across items.
async function checkItemGuardrail(item) {
    const prodId = item.product.id;
    const orderQty = item.qty;
    const effectivePrice = parseFloat(item.product.deal_price || item.product.price || 0);
    const itemCost = parseFloat(item.product.cost_price || 0);

    if (effectivePrice < itemCost) {
        return { error: `We are currently updating pricing for "${item.product.name}". Please remove it from your cart or contact support to proceed.` };
    }

    const { data: liveProd, error: stockCheckErr } = await db.from('products').select('stock_qty, name, sell_oos').eq('id', prodId).single();
    if (stockCheckErr || !liveProd) {
        return { error: `Could not verify stock for ${item.product.name}` };
    }

    const currentStock = liveProd.stock_qty || 0;
    const sellOos = liveProd.sell_oos || 'N';

    if (currentStock < orderQty && sellOos !== 'Y') {
        return { error: `Insufficient stock for "${liveProd.name}". Only ${currentStock} units available.` };
    }

    return { error: null };
}

// Deducts stock for every item in parallel using a single conditional UPDATE
// per item (see comment history below for why .gte() matters here). Returns
// an array of product names that hit a stock issue, if any.
async function deductStockForItems(items) {
    const results = await Promise.all(items.map(async item => {
        const prodId = item.product.id;
        const orderQty = item.qty;
        const sellOos = item.product.sell_oos || 'N';

        const { data: currentP } = await db.from('products').select('stock_qty').eq('id', prodId).single();
        const currentStock = (currentP && currentP.stock_qty) || 0;
        const updatedStock = currentStock - orderQty; // permits negative when sell_oos = 'Y'

        let updateQuery = db.from('products').update({ stock_qty: updatedStock }).eq('id', prodId);
        if (sellOos !== 'Y') {
            updateQuery = updateQuery.gte('stock_qty', orderQty);
        }
        const { data: updatedRows, error: updateErr } = await updateQuery.select();

        if (updateErr) {
            console.error(`Stock update failed for "${item.product.name}":`, updateErr);
            return item.product.name;
        } else if (sellOos !== 'Y' && (!updatedRows || updatedRows.length === 0)) {
            console.warn(`Stock race lost for "${item.product.name}" — flagging order for review.`);
            return item.product.name;
        }
        return null;
    }));

    return results.filter(Boolean);
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

    const warningEl = document.getElementById("confirmation-stock-warning");
    if (warningEl) {
        if (order.stockIssues && order.stockIssues.length > 0) {
            warningEl.style.display = "block";
            warningEl.innerText = `⚠️ Limited availability on: ${order.stockIssues.join(", ")}. Our team will contact you if any substitution is needed.`;
        } else {
            warningEl.style.display = "none";
        }
    }

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

    const cancelBtn = document.getElementById("confirmation-cancel-btn");
    if (cancelBtn) {
        if (order.orderId) {
            cancelBtn.style.display = "inline-block";
            cancelBtn.onclick = () => cancelOrder(order.orderId);
        } else {
            cancelBtn.style.display = "none";
        }
    }
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

        const { error: comboInsertErr } = await db.from('customer_combos').insert([{
            customer_phone: phone,
            combo_name: comboName,
            items_json: items,
            product_signature: productSignature
        }]);
        if (comboInsertErr) throw comboInsertErr;
    } catch (err) {
        console.error("Error saving custom combo template:", err);
    }
}
