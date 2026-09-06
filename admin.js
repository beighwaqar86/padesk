const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";
let db;

// --- BUSINESS / CATEGORY / SUB-CATEGORY / BRAND MASTER DATA ---
// business_master columns are read exactly as shown in the Supabase table
// editor: Business, Category, Sub_Category. brand_master: Brands.
// If these were actually created with different casing, the queries below
// will fail — check the browser console for a clear error naming the table.
let businessMasterRows = []; // [{ id, business, category, subCategory }]
let brandMasterRows = [];    // [{ id, brand }]

const NEW_OPTION_VALUE = "__add_new__";

async function loadBusinessMaster() {
    try {
        const { data, error } = await db.from('business_master').select('*').order('Business');
        if (error) throw error;
        businessMasterRows = (data || []).map(r => ({
            id: r.id,
            business: r.Business,
            category: r.Category,
            subCategory: r.Sub_Category
        }));
    } catch (err) {
        console.error("Could not load business_master (check that its columns are named Business/Category/Sub_Category):", err);
        businessMasterRows = [];
    }
    populateBusinessDropdown();
    renderBusinessMasterTable();
}

async function loadBrandMaster() {
    try {
        const { data, error } = await db.from('brand_master').select('*').order('Brands');
        if (error) throw error;
        brandMasterRows = (data || []).map(r => ({ id: r.id, brand: r.Brands }));
    } catch (err) {
        console.error("Could not load brand_master (check that its column is named Brands):", err);
        brandMasterRows = [];
    }
    populateBrandDropdown();
    renderBrandMasterTable();
}

function populateBusinessDropdown(selected) {
    const select = document.getElementById("p-business");
    if (!select) return;
    let businesses = [...new Set(businessMasterRows.map(r => r.business))].filter(Boolean).sort();
    if (selected && !businesses.includes(selected)) businesses = [selected, ...businesses];

    select.innerHTML = `<option value="">-- Select Business --</option>` +
        businesses.map(b => `<option value="${b}">${b}</option>`).join('') +
        `<option value="${NEW_OPTION_VALUE}">➕ Add New Business...</option>`;

    if (selected) select.value = selected;
}

function populateCategoryDropdown(business, selected) {
    const select = document.getElementById("p-category");
    if (!select) return;

    if (!business) {
        select.innerHTML = `<option value="">-- Select Category --</option>`;
        return;
    }

    let categories = [...new Set(businessMasterRows.filter(r => r.business === business).map(r => r.category))].filter(Boolean).sort();
    if (selected && !categories.includes(selected)) categories = [selected, ...categories];

    select.innerHTML = `<option value="">-- Select Category --</option>` +
        categories.map(c => `<option value="${c}">${c}</option>`).join('') +
        `<option value="${NEW_OPTION_VALUE}">➕ Add New Category...</option>`;

    if (selected) select.value = selected;
}

function populateSubCategoryDropdown(business, category, selected) {
    const select = document.getElementById("p-subcategory");
    if (!select) return;

    if (!business || !category) {
        select.innerHTML = `<option value="">-- Select Sub-Category --</option>`;
        return;
    }

    let subCats = [...new Set(businessMasterRows.filter(r => r.business === business && r.category === category).map(r => r.subCategory))].filter(Boolean).sort();
    if (selected && !subCats.includes(selected)) subCats = [selected, ...subCats];

    select.innerHTML = `<option value="">-- Select Sub-Category --</option>` +
        subCats.map(s => `<option value="${s}">${s}</option>`).join('') +
        `<option value="${NEW_OPTION_VALUE}">➕ Add New Sub-Category...</option>`;

    if (selected) select.value = selected;
}

function populateBrandDropdown(selected) {
    const select = document.getElementById("p-brand");
    if (!select) return;
    let brands = [...new Set(brandMasterRows.map(r => r.brand))].filter(Boolean).sort();
    if (selected && !brands.includes(selected)) brands = [selected, ...brands];

    select.innerHTML = `<option value="">-- Select Brand --</option>` +
        brands.map(b => `<option value="${b}">${b}</option>`).join('') +
        `<option value="${NEW_OPTION_VALUE}">➕ Add New Brand...</option>`;

    if (selected) select.value = selected;
}

// Handles cascading + the inline "Add New..." quick-add flow for
// Business/Category/Sub-Category on the product form.
async function onBusinessMasterFieldChange(level) {
    const businessSelect = document.getElementById("p-business");
    const categorySelect = document.getElementById("p-category");

    if (level === 'business') {
        if (businessSelect.value === NEW_OPTION_VALUE) {
            const newBusiness = prompt("New Business name:");
            if (!newBusiness || !newBusiness.trim()) { businessSelect.value = ""; return; }
            const newCategory = prompt(`New Category under "${newBusiness.trim()}":`);
            if (!newCategory || !newCategory.trim()) { businessSelect.value = ""; return; }
            const newSubCategory = prompt(`New Sub-Category under "${newCategory.trim()}":`);
            if (!newSubCategory || !newSubCategory.trim()) { businessSelect.value = ""; return; }

            const saved = await insertBusinessMasterRow(newBusiness.trim(), newCategory.trim(), newSubCategory.trim());
            if (!saved) { businessSelect.value = ""; return; }

            await loadBusinessMaster();
            populateBusinessDropdown(newBusiness.trim());
            populateCategoryDropdown(newBusiness.trim(), newCategory.trim());
            populateSubCategoryDropdown(newBusiness.trim(), newCategory.trim(), newSubCategory.trim());
            return;
        }
        populateCategoryDropdown(businessSelect.value);
        populateSubCategoryDropdown(null, null); // reset until a category is chosen
        return;
    }

    if (level === 'category') {
        const business = businessSelect.value;
        if (categorySelect.value === NEW_OPTION_VALUE) {
            const newCategory = prompt(`New Category under "${business}":`);
            if (!newCategory || !newCategory.trim()) { categorySelect.value = ""; return; }
            const newSubCategory = prompt(`New Sub-Category under "${newCategory.trim()}":`);
            if (!newSubCategory || !newSubCategory.trim()) { categorySelect.value = ""; return; }

            const saved = await insertBusinessMasterRow(business, newCategory.trim(), newSubCategory.trim());
            if (!saved) { categorySelect.value = ""; return; }

            await loadBusinessMaster();
            populateBusinessDropdown(business);
            populateCategoryDropdown(business, newCategory.trim());
            populateSubCategoryDropdown(business, newCategory.trim(), newSubCategory.trim());
            return;
        }
        populateSubCategoryDropdown(business, categorySelect.value);
        return;
    }

    if (level === 'subcategory') {
        const subCategorySelect = document.getElementById("p-subcategory");
        const business = businessSelect.value;
        const category = categorySelect.value;
        if (subCategorySelect.value === NEW_OPTION_VALUE) {
            const newSubCategory = prompt(`New Sub-Category under "${business} / ${category}":`);
            if (!newSubCategory || !newSubCategory.trim()) { subCategorySelect.value = ""; return; }

            const saved = await insertBusinessMasterRow(business, category, newSubCategory.trim());
            if (!saved) { subCategorySelect.value = ""; return; }

            await loadBusinessMaster();
            populateBusinessDropdown(business);
            populateCategoryDropdown(business, category);
            populateSubCategoryDropdown(business, category, newSubCategory.trim());
        }
    }
}

async function onBrandMasterFieldChange() {
    const brandSelect = document.getElementById("p-brand");
    if (brandSelect.value !== NEW_OPTION_VALUE) return;

    const newBrand = prompt("New Brand name:");
    if (!newBrand || !newBrand.trim()) { brandSelect.value = ""; return; }

    const saved = await insertBrandMasterRow(newBrand.trim());
    if (!saved) { brandSelect.value = ""; return; }

    await loadBrandMaster();
    populateBrandDropdown(newBrand.trim());
}

async function insertBusinessMasterRow(business, category, subCategory) {
    try {
        const { error } = await db.from('business_master').insert([{
            Business: business, Category: category, Sub_Category: subCategory
        }]);
        if (error) throw error;
        return true;
    } catch (err) {
        console.error("Could not save new business/category/sub-category:", err);
        alert("Could not save this entry: " + err.message);
        return false;
    }
}

async function insertBrandMasterRow(brand) {
    try {
        const { error } = await db.from('brand_master').insert([{ Brands: brand }]);
        if (error) throw error;
        return true;
    } catch (err) {
        console.error("Could not save new brand:", err);
        alert("Could not save this brand: " + err.message);
        return false;
    }
}

// --- MANAGE LISTS TAB: bulk add/remove for the master tables ---
async function addBusinessMasterRow(e) {
    e.preventDefault();
    const business = document.getElementById("new-bm-business").value.trim();
    const category = document.getElementById("new-bm-category").value.trim();
    const subCategory = document.getElementById("new-bm-subcategory").value.trim();
    if (!business || !category || !subCategory) return;

    const saved = await insertBusinessMasterRow(business, category, subCategory);
    if (saved) {
        document.getElementById("new-bm-business").value = "";
        document.getElementById("new-bm-category").value = "";
        document.getElementById("new-bm-subcategory").value = "";
        loadBusinessMaster();
    }
}

async function deleteBusinessMasterRow(id) {
    if (!confirm("Remove this combination from the list? Existing products keep their current values.")) return;
    await db.from('business_master').delete().eq('id', id);
    loadBusinessMaster();
}

function renderBusinessMasterTable() {
    const tbody = document.getElementById("admin-business-master-table");
    if (!tbody) return;

    if (businessMasterRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding: 15px; text-align: center; color: #718096;">No entries yet.</td></tr>';
        return;
    }

    tbody.innerHTML = businessMasterRows.map(r => `
        <tr style="border-bottom:1px solid #edf2f7;">
            <td style="padding:8px 10px;">${r.business}</td>
            <td style="padding:8px 10px;">${r.category}</td>
            <td style="padding:8px 10px;">${r.subCategory}</td>
            <td style="padding:8px 10px; text-align:center;">
                <button type="button" onclick="deleteBusinessMasterRow(${r.id})" style="background:#e53e3e; color:white; border:none; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:0.72rem;">Delete</button>
            </td>
        </tr>
    `).join('');
}

async function addBrandMasterRow(e) {
    e.preventDefault();
    const brand = document.getElementById("new-brand-name").value.trim();
    if (!brand) return;

    const saved = await insertBrandMasterRow(brand);
    if (saved) {
        document.getElementById("new-brand-name").value = "";
        loadBrandMaster();
    }
}

async function deleteBrandMasterRow(id) {
    if (!confirm("Remove this brand from the list?")) return;
    await db.from('brand_master').delete().eq('id', id);
    loadBrandMaster();
}

function renderBrandMasterTable() {
    const tbody = document.getElementById("admin-brand-master-table");
    if (!tbody) return;

    if (brandMasterRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="padding: 15px; text-align: center; color: #718096;">No brands yet.</td></tr>';
        return;
    }

    tbody.innerHTML = brandMasterRows.map(r => `
        <tr style="border-bottom:1px solid #edf2f7;">
            <td style="padding:8px 10px;">${r.brand}</td>
            <td style="padding:8px 10px; text-align:center;">
                <button type="button" onclick="deleteBrandMasterRow(${r.id})" style="background:#e53e3e; color:white; border:none; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:0.72rem;">Delete</button>
            </td>
        </tr>
    `).join('');
}

window.onload = function() {
    try {
        db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        loadAdminProducts();
        loadAdminBanners();
        loadAdminOrders();
        loadPurchaseProductDropdown();
        loadStockHoldings();
        loadPurchasesHistory();
        loadStockRequests();
        loadReminderOptIns();
        loadBusinessMaster();
        loadBrandMaster();
        
        // Load Analytics and P&L on initial startup if dashboard tab is active
        loadBIDashboard();
        loadPnLReport();
        
        // Default invoice date to today
        const invDateInput = document.getElementById("purchase-invoice-date");
        if (invDateInput) {
            invDateInput.value = new Date().toISOString().split('T')[0];
        }
    } catch (err) {
        console.error("Initialization error:", err);
    }
};

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));

    const targetTab = document.getElementById(`admin-tab-${tabName}`);
    const targetBtn = document.getElementById(`tab-btn-${tabName}`);

    if (targetTab) targetTab.style.display = 'block';
    if (targetBtn) targetBtn.classList.add('active');

    loadDataForTab(tabName);
}

// Re-fetches whatever data belongs to a given tab. Shared by switchAdminTab
// (loading a tab you just clicked into) and refreshCurrentTab (re-loading the
// tab you're already on, without navigating away from it).
function loadDataForTab(tabName) {
    if (tabName === 'dashboard') {
        loadBIDashboard();
    }
    if (tabName === 'products') {
        loadAdminProducts();
    }
    if (tabName === 'pnl') {
        loadPnLReport();
    }
    if (tabName === 'purchases') {
        loadPurchaseProductDropdown();
        loadPurchasesHistory();
    }
    if (tabName === 'stock') {
        loadStockHoldings();
    }
    if (tabName === 'banners') {
        loadAdminBanners(); // also refreshes saved-combo performance underneath it
    }
    if (tabName === 'fulfillment') {
        loadAdminOrders();
    }
    if (tabName === 'notifications') {
        loadStockRequests();
        loadReminderOptIns();
    }
    if (tabName === 'lists') {
        loadBusinessMaster();
        loadBrandMaster();
    }
    if (tabName === 'ledger') {
        if (ledgerCurrentProduct) {
            loadProductLedger(ledgerCurrentProduct.id, ledgerCurrentProduct.name, ledgerCurrentProduct.code);
        } else {
            loadLedgerProductList();
        }
    }
    if (tabName === 'movement') {
        if (movementCurrentRange) {
            loadStockMovementReport(movementCurrentRange.from, movementCurrentRange.to, movementCurrentRange.label);
        } else {
            setMovementPreset('this_month');
        }
    }
    if (tabName === 'customer-ledger') {
        loadCustLedgerCustomerList();
        if (custLedgerCurrentCustomer) {
            loadCustomerLedger(custLedgerCurrentCustomer.phone, custLedgerCurrentCustomer.name);
        }
    }
}

// Refreshes the tab currently on screen in place — no navigation, no losing
// whatever you were looking at (e.g. a searched-up product in the ledger).
function refreshCurrentTab() {
    const activeBtn = document.querySelector('.admin-tab-btn.active');
    if (!activeBtn) return;
    const tabName = activeBtn.id.replace('tab-btn-', '');
    loadDataForTab(tabName);

    const refreshBtn = document.querySelector('[onclick="refreshCurrentTab()"]');
    if (refreshBtn) {
        const originalText = refreshBtn.innerText;
        refreshBtn.innerText = '✓ Refreshed';
        setTimeout(() => { refreshBtn.innerText = originalText; }, 1200);
    }
}

// --- PRODUCTS CRUD ---
async function loadAdminProducts() {
    const tbody = document.getElementById("admin-product-table");
    if (!tbody) return;

    try {
        const { data, error } = await db.from('products').select('*').order('id', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center;">No products found.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(p => {
            const encodedProduct = encodeURIComponent(JSON.stringify(p));
            return `
                <tr style="border-bottom:1px solid #edf2f7;">
                    <td style="padding:8px;">${p.product_code || '-'}</td>
                    <td style="padding:8px;"><strong>${p.name}</strong></td>
                    <td style="padding:8px;"><span style="background:#e6f7f0; color:#0baf65; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">${p.business || ''}</span> / ${p.category}</td>
                    <td style="padding:8px;">K ${parseFloat(p.deal_price || p.price).toFixed(2)}</td>
                    <td style="padding:8px; text-align:center;">
                        <button type="button" onclick='editProductFromEncoded("${encodedProduct}")' style="background:#3182ce; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Edit</button>
                        <button type="button" onclick="deleteProduct(${p.id})" style="background:#e53e3e; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Del</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error loading products:", err);
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: red;">Failed to load products.</td></tr>';
    }
}

// Helper function to safely decode and edit product without syntax crashes
function editProductFromEncoded(encodedStr) {
    try {
        const p = JSON.parse(decodeURIComponent(encodedStr));
        editProduct(p);
    } catch (e) {
        console.error("Error decoding product:", e);
    }
}

// Two-Way Smart Pricing Calculator
function calculatePricing(source) {
    const costInput = document.getElementById("p-cost-price");
    const markupInput = document.getElementById("p-markup");
    const priceInput = document.getElementById("p-price");
    const dealPriceInput = document.getElementById("p-deal-price");

    if (!costInput || !markupInput || !priceInput) return;

    let cost = parseFloat(costInput.value) || 0;
    let markup = parseFloat(markupInput.value) || 0;
    let price = parseFloat(priceInput.value) || 0;

    if (cost <= 0) return; // Need a cost base to calculate margins

    if (source === 'markup' || source === 'cost') {
        // Forward Calc: User changes Markup or Cost -> Calculate Selling Prices
        price = cost + (cost * (markup / 100));
        priceInput.value = price.toFixed(2);
        
        // Auto-populate Deal Price to match, preventing accidental below-cost errors
        if (dealPriceInput) {
            dealPriceInput.value = price.toFixed(2);
        }
    } else if (source === 'price') {
        // Reverse Calc: User manually types Regular Selling Price -> Calculate Markup
        markup = ((price - cost) / cost) * 100;
        markupInput.value = markup.toFixed(2);
    }
}

async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById("product-id").value;
    
    const dealPriceRaw = document.getElementById("p-deal-price").value;
    const dealPrice = dealPriceRaw ? parseFloat(dealPriceRaw) : null;
    const regularPrice = parseFloat(document.getElementById("p-price").value);
    const costPrice = parseFloat(document.getElementById("p-cost-price").value) || 0;

    const payload = {
        name: document.getElementById("p-name").value.trim(),
        product_code: document.getElementById("p-code").value.trim() || null,
        business: document.getElementById("p-business").value,
        category: document.getElementById("p-category").value.trim(),
        sub_category: document.getElementById("p-subcategory").value.trim() || null,
        cost_price: costPrice,
        target_margin_pct: parseFloat(document.getElementById("p-markup").value) || 0,
        price: regularPrice,
        deal_price: dealPrice,
        brand: document.getElementById("p-brand").value.trim() || null,
        image_url: document.getElementById("p-image").value.trim() || null,
        sell_oos: document.getElementById("p-sell-oos").value,
        is_active: document.getElementById("p-active").checked
    };
    
    // Safety check: Don't sell below cost on EITHER the regular price or the deal price
    if (regularPrice < costPrice || (dealPrice !== null && dealPrice < costPrice)) {
        const lowestPrice = (dealPrice !== null && dealPrice < regularPrice) ? dealPrice : regularPrice;
        if (!confirm(`⚠️ FINANCIAL ALERT: Your selling price (K ${lowestPrice}) is below the Cost Price (K ${costPrice}). Are you sure you want to save?`)) return;
    }

    const query = id ? db.from('products').update(payload).eq('id', id) : db.from('products').insert([payload]);
    const { error } = await query;
    if (error) {
        alert("Error: " + error.message);
    } else {
        alert(id ? "Product updated successfully!" : "Product created! Navigate to 'Stock Purchase' to receive initial inventory.");
        resetProductForm();
        loadAdminProducts();
        loadStockHoldings();
        loadPurchaseProductDropdown();
    }
}

function editProduct(p) {
    document.getElementById("product-id").value = p.id;
    document.getElementById("p-name").value = p.name;
    document.getElementById("p-code").value = p.product_code || '';

    // Cascading dropdowns must be populated level-by-level so each select
    // has the right options before we try to set its value.
    populateBusinessDropdown(p.business || '');
    populateCategoryDropdown(p.business || '', p.category || '');
    populateSubCategoryDropdown(p.business || '', p.category || '', p.sub_category || '');
    populateBrandDropdown(p.brand || '');
    
    // Pricing Module Mapping and Locking
    const costInput = document.getElementById("p-cost-price");
    if (costInput) {
        costInput.value = p.cost_price || 0;
        costInput.readOnly = true; // Lock cost price on edit
        costInput.style.background = "#edf2f7"; // Visually indicate it's locked
    }
    
    const markupInput = document.getElementById("p-markup");
    if (markupInput) markupInput.value = p.target_margin_pct || 0;

    document.getElementById("p-price").value = p.price;
    document.getElementById("p-deal-price").value = p.deal_price || '';
    
    document.getElementById("p-image").value = p.image_url || '';
    document.getElementById("p-sell-oos").value = p.sell_oos || 'N';
    document.getElementById("p-active").checked = p.is_active;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteProduct(id) {
    if (!confirm("Delete product?")) return;
    await db.from('products').delete().eq('id', id);
    loadAdminProducts();
    loadStockHoldings();
    loadPurchaseProductDropdown();
}

function resetProductForm() {
    document.getElementById("admin-product-form").reset();
    document.getElementById("product-id").value = "";

    // Explicitly reset the cascading dropdowns back to a clean "nothing selected" state
    populateBusinessDropdown("");
    populateCategoryDropdown(null, "");
    populateSubCategoryDropdown(null, null, "");
    populateBrandDropdown("");
    
    // Unlock cost price for new product entry
    const costInput = document.getElementById("p-cost-price");
    if (costInput) {
        costInput.readOnly = false;
        costInput.style.background = "#ffffff";
    }
}

// --- PURCHASES MODULE ---
async function loadPurchaseProductDropdown() {
    const selectEl = document.getElementById("purchase-product-select");
    if (!selectEl) return;

    try {
        const { data: products, error } = await db.from('products').select('id, name, product_code, cost_price').order('name');
        if (error) throw error;

        selectEl.innerHTML = '<option value="">-- Choose Product --</option>' + (products || []).map(p => `
            <option value="${p.id}">${p.name} (Code: ${p.product_code || '-'} | Current Cost: K ${parseFloat(p.cost_price || 0).toFixed(2)})</option>
        `).join('');
    } catch (err) {
        console.error("Error loading product dropdown:", err);
    }
}

async function recordPurchase(event) {
    event.preventDefault();
    
    const productId = document.getElementById("purchase-product-select").value;
    const qty = parseInt(document.getElementById("purchase-qty").value);
    const unitCost = parseFloat(document.getElementById("purchase-unit-cost").value);
    const supplier = document.getElementById("purchase-supplier").value.trim();
    const invoiceRef = document.getElementById("purchase-invoice").value.trim();
    const invoiceDate = document.getElementById("purchase-invoice-date").value;

    if (!productId || !qty || !unitCost || !supplier || !invoiceDate) {
        return alert("Please fill in all required purchase details including invoice date.");
    }

    try {
        const { data: prod, error: fetchErr } = await db.from('products').select('*').eq('id', productId).single();
        if (fetchErr) throw fetchErr;

        const currentSellingPrice = parseFloat(prod.deal_price || prod.price);
        
        if (unitCost > currentSellingPrice) {
            const confirmOverride = confirm(`⚠️ FINANCIAL ALERT: Purchase unit cost (K ${unitCost.toFixed(2)}) is HIGHER than current selling price (K ${currentSellingPrice.toFixed(2)})! Proceed?`);
            if (!confirmOverride) return;
        }

        const dParts = invoiceDate.split('-');
        const dateStr = `${dParts[2]}${dParts[1]}${dParts[0]}`;
        
        const { count } = await db.from('purchases').select('*', { count: 'exact', head: true }).eq('invoice_date', invoiceDate);
        const seqNum = String((count || 0) + 1).padStart(2, '0');
        const poCode = `PO${dateStr}${seqNum}`;

        const { error: purchaseErr } = await db.from('purchases').insert([{
            po_code: poCode,
            supplier_name: supplier,
            invoice_ref: invoiceRef,
            invoice_date: invoiceDate,
            purchase_date: invoiceDate,
            product_id: parseInt(productId),
            qty_received: qty,
            purchase_unit_cost: unitCost,
            recorded_by: 'Admin'
        }]);
        if (purchaseErr) throw purchaseErr;

        const newStock = (prod.stock_qty || 0) + qty;
        
        const currentPrice = parseFloat(prod.price || 0);
        let newMarginPct = prod.target_margin_pct || 0;
        
        if (unitCost > 0) {
            newMarginPct = ((currentPrice - unitCost) / unitCost) * 100;
        }

        const { error: updateErr } = await db.from('products').update({
            stock_qty: newStock,
            cost_price: unitCost,
            target_margin_pct: newMarginPct
        }).eq('id', productId);

        if (updateErr) throw updateErr;

        alert(`✅ Stock purchase recorded successfully! PO Code: ${poCode}`);
        document.getElementById("purchase-form").reset();
        document.getElementById("purchase-invoice-date").value = new Date().toISOString().split('T')[0];
        
        loadAdminProducts();
        loadStockHoldings();
        loadPurchasesHistory();
        loadPurchaseProductDropdown();

    } catch (err) {
        console.error("Purchase error:", err);
        alert("Failed to record purchase: " + err.message);
    }
}

async function loadPurchasesHistory() {
    const tbody = document.getElementById("admin-purchases-history-table");
    if (!tbody) return;

    try {
        const { data: purchases, error } = await db.from('purchases').select('*, products(name, product_code)').order('id', { ascending: false });
        if (error) throw error;

        if (!purchases || purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="padding: 15px; text-align: center; color: #718096;">No purchase orders recorded yet.</td></tr>';
            return;
        }

        tbody.innerHTML = purchases.map(p => {
            const poCode = p.po_code || '-';
            const invDate = p.invoice_date || '-';
            const invRef = p.invoice_ref || '-';

            const prodName = p.products ? p.products.name : 'Unknown Product';
            const totalCost = (p.qty_received || 0) * parseFloat(p.purchase_unit_cost || 0);

            return `
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 9px; font-weight: bold; color: #2b6cb0;">${poCode}</td>
                    <td style="padding: 9px; color: #4a5568; white-space: nowrap;">${invDate}</td>
                    <td style="padding: 9px; color: #4a5568; font-weight: 500;">${invRef}</td>
                    <td style="padding: 9px;">${p.supplier_name || '-'}</td>
                    <td style="padding: 9px; font-weight: 600;">${prodName}</td>
                    <td style="padding: 9px; text-align: center;">${p.qty_received || 0}</td>
                    <td style="padding: 9px; text-align: right;">K ${parseFloat(p.purchase_unit_cost || 0).toFixed(2)}</td>
                    <td style="padding: 9px; text-align: right; font-weight: bold; color: #0baf65;">K ${totalCost.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error loading purchases history:", err);
        tbody.innerHTML = `<tr><td colspan="8" style="padding: 15px; text-align: center; color: red;">Failed to load purchase history.</td></tr>`;
    }
}

// --- STOCK ON HAND ---
const LOW_STOCK_THRESHOLD = 10; // adjust here if you want a different cutoff for "low stock"
let stockHoldingsCache = [];
let stockShowOnlyLowFlag = false;

async function loadStockHoldings() {
    const tbody = document.getElementById("admin-stock-holdings-table");
    if (!tbody) return;

    try {
        const { data: products, error } = await db.from('products').select('*').order('name');
        if (error) throw error;
        stockHoldingsCache = products || [];
        renderStockHoldings();
    } catch (err) {
        console.error("Error loading stock:", err);
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: red;">Failed to load stock data.</td></tr>';
    }
}

function toggleLowStockOnly() {
    stockShowOnlyLowFlag = !stockShowOnlyLowFlag;
    renderStockHoldings();
}

function renderStockHoldings() {
    const tbody = document.getElementById("admin-stock-holdings-table");
    const summaryEl = document.getElementById("stock-alert-summary");
    if (!tbody) return;

    if (stockHoldingsCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 15px; text-align: center;">No products found in inventory.</td></tr>';
        if (summaryEl) summaryEl.innerHTML = '';
        return;
    }

    const outOfStockBlocked = stockHoldingsCache.filter(p => (p.stock_qty || 0) <= 0 && (p.sell_oos || 'N') !== 'Y');
    const sellingNegative = stockHoldingsCache.filter(p => (p.stock_qty || 0) <= 0 && (p.sell_oos || 'N') === 'Y');
    const lowStock = stockHoldingsCache.filter(p => (p.stock_qty || 0) > 0 && (p.stock_qty || 0) <= LOW_STOCK_THRESHOLD);
    const alertCount = outOfStockBlocked.length + sellingNegative.length + lowStock.length;

    if (summaryEl) {
        summaryEl.innerHTML = alertCount > 0 ? `
            <div style="background: #fffaf0; border: 1px solid #f6d78e; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="font-size: 0.85rem; color: #975a16;">
                    <strong>⚠️ ${alertCount} item(s) need attention:</strong>
                    ${outOfStockBlocked.length} out of stock (blocked),
                    ${sellingNegative.length} selling into negative stock,
                    ${lowStock.length} running low (≤ ${LOW_STOCK_THRESHOLD} units)
                </div>
                <button type="button" onclick="toggleLowStockOnly()" style="background: ${stockShowOnlyLowFlag ? '#975a16' : 'white'}; color: ${stockShowOnlyLowFlag ? 'white' : '#975a16'}; border: 1px solid #975a16; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 0.78rem; cursor: pointer; white-space: nowrap;">
                    ${stockShowOnlyLowFlag ? 'Show All Products' : 'Show Only These'}
                </button>
            </div>
        ` : `<div style="background: #e6f7f0; border: 1px solid #b2f5ea; border-radius: 8px; padding: 10px 16px; margin-bottom: 16px; color: #0baf65; font-size: 0.85rem; font-weight: 600;">✅ All products are healthily stocked.</div>`;
    }

    const productsToShow = stockShowOnlyLowFlag
        ? stockHoldingsCache.filter(p => {
            const qty = p.stock_qty || 0;
            return qty <= 0 || qty <= LOW_STOCK_THRESHOLD;
        })
        : stockHoldingsCache;

    if (productsToShow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 15px; text-align: center; color: #718096;">Nothing matches this filter.</td></tr>';
        return;
    }

    let totalInventoryCapital = 0;

    tbody.innerHTML = productsToShow.map(p => {
        const qty = p.stock_qty || 0;
        const sellOos = p.sell_oos || 'N';
        const unitCost = parseFloat(p.cost_price || 0);
        const totalVal = qty * unitCost;
        totalInventoryCapital += totalVal;

        let badgeStyle, badgeLabel;
        if (qty <= 0 && sellOos === 'Y') {
            badgeStyle = 'background: #e9d8fd; color: #6b46c1; padding: 2px 8px; border-radius: 4px; font-weight: bold;';
            badgeLabel = `${qty} units ⚠️ Selling OOS`;
        } else if (qty <= 0) {
            badgeStyle = 'background: #fed7d7; color: #c53030; padding: 2px 8px; border-radius: 4px; font-weight: bold;';
            badgeLabel = `${qty} units — Out of Stock`;
        } else if (qty <= LOW_STOCK_THRESHOLD) {
            badgeStyle = 'background: #fffaf0; color: #975a16; padding: 2px 8px; border-radius: 4px; font-weight: bold;';
            badgeLabel = `${qty} units — Low`;
        } else {
            badgeStyle = 'background: #e6f7f0; color: #0baf65; padding: 2px 8px; border-radius: 4px; font-weight: bold;';
            badgeLabel = `${qty} units`;
        }

        return `
            <tr style="border-bottom: 1px solid #edf2f7;">
                <td style="padding: 10px; color: #4a5568;">${p.product_code || '-'}</td>
                <td style="padding: 10px; font-weight: 600;">${p.name}</td>
                <td style="padding: 10px; text-align: center;"><span style="${badgeStyle}">${badgeLabel}</span></td>
                <td style="padding: 10px; text-align: right;">K ${unitCost.toFixed(2)}</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">K ${totalVal.toFixed(2)}</td>
            </tr>
        `;
    }).join('') + `
        <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e0;">
            <td colspan="4" style="padding: 12px; text-align: right;">Total Inventory Asset Value${stockShowOnlyLowFlag ? ' (filtered)' : ''}:</td>
            <td style="padding: 12px; text-align: right; color: #0baf65;">K ${totalInventoryCapital.toFixed(2)}</td>
        </tr>
    `;
}

// --- PRODUCT LEDGER / STATEMENT ---
let ledgerProductsCache = [];
let ledgerCustomerNameByPhone = {};
let ledgerOpenOrdersCache = [];
let ledgerCurrentProduct = null; // { id, name, code } — lets refreshCurrentTab() restore the view

function toggleLedgerOpenOrdersDetail() {
    const detailEl = document.getElementById("ledger-open-orders-detail");
    if (!detailEl) return;

    const isOpen = detailEl.style.display !== "none";
    if (isOpen) {
        detailEl.style.display = "none";
        return;
    }

    detailEl.innerHTML = `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
            <div style="font-weight:700; font-size:0.8rem; color:#4a5568; margin-bottom:8px;">Orders contributing to Open Order Qty:</div>
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.8rem;">
                <thead>
                    <tr style="border-bottom:1px solid #edf2f7; color:#718096;">
                        <th style="padding:6px;">Order No.</th>
                        <th style="padding:6px;">Date</th>
                        <th style="padding:6px;">Status</th>
                        <th style="padding:6px;">Customer</th>
                        <th style="padding:6px; text-align:right;">Qty</th>
                    </tr>
                </thead>
                <tbody>
                    ${ledgerOpenOrdersCache.map(o => `
                        <tr style="border-bottom:1px solid #f7fafc;">
                            <td style="padding:6px;">${o.ref}</td>
                            <td style="padding:6px;">${o.date ? new Date(o.date).toLocaleDateString() : '-'}</td>
                            <td style="padding:6px;"><span style="color:#3182ce; font-weight:600;">${o.status}</span></td>
                            <td style="padding:6px;">${o.party}</td>
                            <td style="padding:6px; text-align:right; font-weight:600;">${o.qty}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    detailEl.style.display = "block";
}

async function loadLedgerProductList() {
    try {
        const { data: products, error } = await db.from('products').select('id, name, product_code').order('name');
        if (error) throw error;
        ledgerProductsCache = products || [];

        const datalist = document.getElementById("ledger-product-datalist");
        if (datalist) {
            datalist.innerHTML = ledgerProductsCache.map(p =>
                `<option value="${p.name}${p.product_code ? ' (' + p.product_code + ')' : ' (#' + p.id + ')'}">`
            ).join('');
        }
    } catch (err) {
        console.error("Could not load product list for ledger:", err);
    }
}

function onLedgerProductSearchChange() {
    const input = document.getElementById("ledger-product-search");
    if (!input) return;
    const typed = input.value.trim();

    // Match on the "(code)" or "(#id)" suffix the datalist option carries, so
    // picking an exact suggestion resolves unambiguously even with duplicate names.
    const match = typed.match(/\(([^)]+)\)\s*$/);
    let product = null;

    if (match) {
        const key = match[1];
        product = ledgerProductsCache.find(p => p.product_code === key || `#${p.id}` === key);
    }
    if (!product) {
        // Fallback: exact name match (covers typing without picking the suggestion)
        product = ledgerProductsCache.find(p => p.name === typed);
    }

    if (product) {
        loadProductLedger(product.id, product.name, product.product_code);
    }
}

async function loadProductLedger(productId, productName, productCode) {
    ledgerCurrentProduct = { id: productId, name: productName, code: productCode };

    const resultsContainer = document.getElementById("ledger-results-container");
    const tbody = document.getElementById("ledger-transactions-table");
    const titleEl = document.getElementById("ledger-product-title");
    const subtitleEl = document.getElementById("ledger-product-subtitle");
    const reconEl = document.getElementById("ledger-reconciliation-note");
    if (!resultsContainer || !tbody) return;

    resultsContainer.style.display = "block";
    titleEl.innerText = productName;
    subtitleEl.innerText = productCode ? `Code: ${productCode}` : '';
    tbody.innerHTML = `<tr><td colspan="11" style="padding:15px; text-align:center; color:#718096;">Loading ledger...</td></tr>`;
    reconEl.innerHTML = '';
    const openOrdersDetailEl = document.getElementById("ledger-open-orders-detail");
    if (openOrdersDetailEl) { openOrdersDetailEl.style.display = "none"; openOrdersDetailEl.innerHTML = ''; }

    try {
        // Build/reuse a phone → name lookup so Sale rows can show a customer name
        if (Object.keys(ledgerCustomerNameByPhone).length === 0) {
            const { data: customers } = await db.from('customers').select('phone_number, title, first_name, last_name');
            (customers || []).forEach(c => {
                ledgerCustomerNameByPhone[c.phone_number] = `${c.title || ''} ${c.first_name || ''} ${c.last_name || ''}`.trim();
            });
        }

        const [{ data: purchases, error: purchErr }, { data: deliveredOrders, error: ordErr }, { data: openOrdersRaw, error: openErr }, { data: liveProduct }] = await Promise.all([
            db.from('purchases').select('*').eq('product_id', productId),
            db.from('orders').select('*').eq('fulfillment_status', 'Delivered'),
            db.from('orders').select('*').neq('fulfillment_status', 'Delivered').neq('fulfillment_status', 'Cancelled'),
            db.from('products').select('stock_qty').eq('id', productId).single()
        ]);
        if (purchErr) throw purchErr;
        if (ordErr) throw ordErr;
        if (openErr) throw openErr;

        const transactions = [];

        (purchases || []).forEach(p => {
            const qty = p.qty_received || 0;
            const unitCost = parseFloat(p.purchase_unit_cost || 0);
            transactions.push({
                date: p.purchase_date || p.invoice_date,
                type: 'Purchase',
                ref: p.invoice_ref || p.po_code || '-',
                party: p.supplier_name || '-',
                debitQty: qty,
                debitValue: qty * unitCost,
                creditQty: 0,
                creditValue: 0
            });
        });

        (deliveredOrders || []).forEach(o => {
            const items = o.order_items_json || [];
            items.filter(item => item.product && item.product.id === productId).forEach(item => {
                const qty = item.qty || 0;
                const invoicePrice = parseFloat(item.product.deal_price || item.product.price || 0);
                transactions.push({
                    date: o.delivered_at || o.created_at,
                    type: 'Sale',
                    ref: o.order_number || `#ORD-${o.id}`,
                    party: ledgerCustomerNameByPhone[o.customer_phone] || o.customer_phone || '-',
                    debitQty: 0,
                    debitValue: 0,
                    creditQty: qty,
                    creditValue: qty * invoicePrice
                });
            });
        });

        // Orders still in Placed/Aggregating/Dispatched — their stock is already
        // deducted from live stock_qty, but they haven't been recorded as a Sale
        // in this ledger yet (that only happens at Delivered).
        const openOrdersForProduct = [];
        (openOrdersRaw || []).forEach(o => {
            const items = o.order_items_json || [];
            items.filter(item => item.product && item.product.id === productId).forEach(item => {
                openOrdersForProduct.push({
                    date: o.created_at,
                    ref: o.order_number || `#ORD-${o.id}`,
                    party: ledgerCustomerNameByPhone[o.customer_phone] || o.customer_phone || '-',
                    status: o.fulfillment_status,
                    qty: item.qty || 0
                });
            });
        });
        const openOrderQty = openOrdersForProduct.reduce((sum, o) => sum + o.qty, 0);
        ledgerOpenOrdersCache = openOrdersForProduct; // for the drill-down click

        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" style="padding:15px; text-align:center; color:#718096;">No purchase or delivered-sale transactions found for this product yet.</td></tr>`;
            reconEl.innerHTML = '';
            return;
        }

        let balQty = 0, balValue = 0;
        tbody.innerHTML = transactions.map((t, idx) => {
            balQty += t.debitQty - t.creditQty;
            balValue += t.debitValue - t.creditValue;
            const typeColor = t.type === 'Purchase' ? '#0baf65' : '#3182ce';
            return `
                <tr style="border-bottom:1px solid #edf2f7;">
                    <td style="padding:7px 6px;">${idx + 1}</td>
                    <td style="padding:7px 6px; white-space:nowrap;">${t.date ? new Date(t.date).toLocaleDateString() : '-'}</td>
                    <td style="padding:7px 6px;"><span style="color:${typeColor}; font-weight:bold;">${t.type}</span></td>
                    <td style="padding:7px 6px;">${t.ref}</td>
                    <td style="padding:7px 6px;">${t.party}</td>
                    <td style="padding:7px 6px; text-align:right;">${t.debitQty || ''}</td>
                    <td style="padding:7px 6px; text-align:right;">${t.debitValue ? 'K ' + t.debitValue.toFixed(2) : ''}</td>
                    <td style="padding:7px 6px; text-align:right;">${t.creditQty || ''}</td>
                    <td style="padding:7px 6px; text-align:right;">${t.creditValue ? 'K ' + t.creditValue.toFixed(2) : ''}</td>
                    <td style="padding:7px 6px; text-align:right; font-weight:bold;">${balQty}</td>
                    <td style="padding:7px 6px; text-align:right; font-weight:bold;">K ${balValue.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        const liveStock = (liveProduct && liveProduct.stock_qty) || 0;
        const mismatch = liveStock !== balQty;
        const expectedFromOpenOrders = balQty - openOrderQty;
        const stillUnexplained = expectedFromOpenOrders !== liveStock;
        const negativeBalance = balQty < 0;

        reconEl.innerHTML = `
            <div style="background: ${mismatch ? '#fffaf0' : '#e6f7f0'}; border: 1px solid ${mismatch ? '#f6d78e' : '#b2f5ea'}; border-radius: 8px; padding: 12px 16px; font-size: 0.82rem; color: ${mismatch ? '#975a16' : '#0baf65'}; margin-bottom: ${negativeBalance ? '10px' : '0'};">
                <strong>Ledger Balance Qty:</strong> ${balQty}
                &nbsp;|&nbsp;
                <span style="${openOrderQty > 0 ? 'text-decoration: underline; cursor: pointer;' : ''}" ${openOrderQty > 0 ? 'onclick="toggleLedgerOpenOrdersDetail()"' : ''}>
                    <strong>Open Order Qty:</strong> ${openOrderQty}${openOrderQty > 0 ? ' 🔍' : ''}
                </span>
                &nbsp;|&nbsp;
                <strong>Live Stock Qty:</strong> ${liveStock}
                ${mismatch ? `
                    <br><span style="color:#975a16;">
                        ${openOrderQty > 0
                            ? `${balQty} (ledger) − ${openOrderQty} (open orders, already deducted but not yet Delivered) = ${expectedFromOpenOrders}${stillUnexplained ? `, which still doesn't match live stock of ${liveStock} — the remaining ${Math.abs(expectedFromOpenOrders - liveStock)} unit(s) may reflect a manual stock edit outside the normal Purchases flow.` : ', which matches live stock — fully explained by orders in progress.'}`
                            : `There are no open (in-progress) orders for this product, so this gap likely reflects either a manual stock edit outside the normal Purchases flow, or an order that was cancelled (stock restored) and later reactivated before this fix — check Order Fulfillment for any such order and re-save its status to trigger a correction.`
                        }
                    </span>
                ` : `<br><span>Ledger and live stock agree.</span>`}
            </div>
            ${negativeBalance ? `
                <div style="background: #e9d8fd; border: 1px solid #d6bcfa; border-radius: 8px; padding: 12px 16px; font-size: 0.82rem; color: #6b46c1;">
                    ⚠️ <strong>Negative balance:</strong> this product has been sold ${transactions.some(t => t.type === 'Purchase') ? 'more than has been purchased' : 'with no purchase history at all'} — it's currently being sold on the "Allow OOS Sale" setting. Ledger and live stock agreeing on a negative number just means the shortfall is being tracked consistently; it's not a data error. Record a Stock Purchase for this product when new stock arrives to bring both back to a normal positive balance.
                </div>
            ` : ''}
        `;
    } catch (err) {
        console.error("Error loading product ledger:", err);
        tbody.innerHTML = `<tr><td colspan="11" style="padding:15px; text-align:center; color:red;">Failed to load ledger data.</td></tr>`;
    }
}

// Jumps from the movement report straight into that product's full ledger
function jumpToProductLedger(productId) {
    const info = movementProductInfoCache[productId] || {};
    ledgerCurrentProduct = { id: productId, name: info.name || 'Unknown Product', code: info.product_code || '' };
    switchAdminTab('ledger');
}

// --- CUSTOMER LEDGER / ACCOUNTS RECEIVABLE ---
let custLedgerCustomersCache = [];
let custLedgerCurrentCustomer = null; // { phone, name } — for refreshCurrentTab()

async function loadCustLedgerCustomerList() {
    try {
        const { data: customers, error } = await db.from('customers').select('phone_number, title, first_name, last_name').order('first_name');
        if (error) throw error;
        custLedgerCustomersCache = (customers || []).map(c => ({
            phone: c.phone_number,
            name: `${c.title || ''} ${c.first_name || ''} ${c.last_name || ''}`.trim() || c.phone_number
        }));

        const datalist = document.getElementById("cust-ledger-datalist");
        if (datalist) {
            datalist.innerHTML = custLedgerCustomersCache.map(c =>
                `<option value="${c.name} (${c.phone})">`
            ).join('');
        }
    } catch (err) {
        console.error("Could not load customer list for ledger:", err);
    }
}

function onCustLedgerSearchChange() {
    const input = document.getElementById("cust-ledger-search");
    if (!input) return;
    const typed = input.value.trim();

    // Prefer matching the "(phone)" suffix from a picked suggestion — unambiguous
    // even with duplicate names. Fall back to a raw phone-number match for
    // anyone who just types digits without picking a suggestion.
    const match = typed.match(/\(([^)]+)\)\s*$/);
    let customer = null;

    if (match) {
        customer = custLedgerCustomersCache.find(c => c.phone === match[1]);
    }
    if (!customer) {
        customer = custLedgerCustomersCache.find(c => c.phone === typed || c.name === typed);
    }

    if (customer) {
        loadCustomerLedger(customer.phone, customer.name);
    }
}

async function loadCustomerLedger(phone, name) {
    custLedgerCurrentCustomer = { phone, name };

    const resultsEl = document.getElementById("cust-ledger-results");
    const nameEl = document.getElementById("cust-ledger-name");
    const phoneEl = document.getElementById("cust-ledger-phone");
    const balanceBadgeEl = document.getElementById("cust-ledger-balance-badge");
    const pendingNoteEl = document.getElementById("cust-ledger-pending-note");
    const tbody = document.getElementById("cust-ledger-table");
    if (!resultsEl || !tbody) return;

    resultsEl.style.display = "block";
    nameEl.innerText = name;
    phoneEl.innerText = phone;
    tbody.innerHTML = `<tr><td colspan="8" style="padding:15px; text-align:center; color:#718096;">Loading...</td></tr>`;

    // Default the payment form's date to today for convenience
    const dateInput = document.getElementById("payment-date");
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];

    try {
        const [{ data: deliveredOrders, error: ordErr }, { data: pendingOrders, error: pendErr }, { data: payments, error: payErr }] = await Promise.all([
            db.from('orders').select('*').eq('customer_phone', phone).eq('fulfillment_status', 'Delivered'),
            db.from('orders').select('*').eq('customer_phone', phone).not('fulfillment_status', 'in', '("Delivered","Cancelled")'),
            db.from('customer_payments').select('*').eq('customer_phone', phone)
        ]);
        if (ordErr) throw ordErr;
        if (pendErr) throw pendErr;
        if (payErr) throw payErr;

        const transactions = [];

        (deliveredOrders || []).forEach(o => {
            transactions.push({
                date: o.delivered_at || o.created_at,
                type: 'Invoice',
                ref: o.order_number || `#ORD-${o.id}`,
                debit: parseFloat(o.total_amount || 0),
                credit: 0,
                deletable: false
            });
        });

        (payments || []).forEach(p => {
            // payment_date only has day-level precision (no time-of-day), so two
            // payments recorded minutes apart on the same day, or a payment and
            // a same-day invoice, can't be interleaved correctly using it alone.
            // Combining the user-specified DATE (authoritative — respects a
            // deliberately backdated entry) with the actual TIME-OF-DAY from
            // created_at (when the record was really inserted) gives correct
            // same-day ordering without losing that backdating ability.
            const timeOfDay = p.created_at ? p.created_at.split('T')[1] : '12:00:00';
            transactions.push({
                date: `${p.payment_date}T${timeOfDay}`,
                type: 'Payment',
                ref: `${p.payment_method || 'Payment'}${p.note ? ' — ' + p.note : ''}`,
                debit: 0,
                credit: parseFloat(p.amount || 0),
                deletable: true,
                paymentId: p.id
            });
        });

        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        let balance = 0;
        tbody.innerHTML = transactions.length === 0
            ? `<tr><td colspan="8" style="padding:15px; text-align:center; color:#718096;">No invoices or payments recorded yet.</td></tr>`
            : transactions.map((t, idx) => {
                balance += t.debit - t.credit;
                const typeColor = t.type === 'Invoice' ? '#3182ce' : '#0baf65';
                return `
                    <tr style="border-bottom:1px solid #edf2f7;">
                        <td style="padding:7px 6px;">${idx + 1}</td>
                        <td style="padding:7px 6px; white-space:nowrap;">${t.date ? new Date(t.date).toLocaleDateString() : '-'}</td>
                        <td style="padding:7px 6px;"><span style="color:${typeColor}; font-weight:bold;">${t.type}</span></td>
                        <td style="padding:7px 6px;">${t.ref}</td>
                        <td style="padding:7px 6px; text-align:right;">${t.debit ? 'K ' + t.debit.toFixed(2) : ''}</td>
                        <td style="padding:7px 6px; text-align:right;">${t.credit ? 'K ' + t.credit.toFixed(2) : ''}</td>
                        <td style="padding:7px 6px; text-align:right; font-weight:bold;">K ${balance.toFixed(2)}</td>
                        <td style="padding:7px 6px; text-align:center;">${t.deletable ? `<button type="button" onclick="deleteCustomerPayment(${t.paymentId})" style="background:#e53e3e; color:white; border:none; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:0.7rem;">Delete</button>` : ''}</td>
                    </tr>
                `;
            }).join('');

        const pendingTotal = (pendingOrders || []).reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

        if (balanceBadgeEl) {
            balanceBadgeEl.innerHTML = balance > 0
                ? `<span style="color:#e53e3e;">Owes K ${balance.toFixed(2)}</span>`
                : balance < 0
                    ? `<span style="color:#3182ce;">Credit K ${Math.abs(balance).toFixed(2)}</span>`
                    : `<span style="color:#0baf65;">Settled (K 0.00)</span>`;
        }
        if (pendingNoteEl) {
            pendingNoteEl.innerText = pendingTotal > 0
                ? `Plus K ${pendingTotal.toFixed(2)} in orders placed but not yet delivered (not yet invoiced on this ledger).`
                : '';
        }
    } catch (err) {
        console.error("Error loading customer ledger:", err);
        tbody.innerHTML = `<tr><td colspan="8" style="padding:15px; text-align:center; color:red;">Failed to load ledger. If customer_payments doesn't exist yet, run the latest db-migration.sql first.</td></tr>`;
    }
}

async function recordCustomerPayment(e) {
    e.preventDefault();
    if (!custLedgerCurrentCustomer) return;

    const amount = parseFloat(document.getElementById("payment-amount").value);
    const date = document.getElementById("payment-date").value;
    const method = document.getElementById("payment-method").value;
    const note = document.getElementById("payment-note").value.trim() || null;

    if (!amount || amount <= 0) {
        alert("Please enter a valid payment amount.");
        return;
    }

    try {
        const { error } = await db.from('customer_payments').insert([{
            customer_phone: custLedgerCurrentCustomer.phone,
            amount: amount,
            payment_date: date,
            payment_method: method,
            note: note
        }]);
        if (error) throw error;

        document.getElementById("payment-amount").value = '';
        document.getElementById("payment-note").value = '';
        loadCustomerLedger(custLedgerCurrentCustomer.phone, custLedgerCurrentCustomer.name);
    } catch (err) {
        console.error("Error recording payment:", err);
        alert("Could not record this payment: " + err.message);
    }
}

async function deleteCustomerPayment(paymentId) {
    if (!confirm("Delete this payment record? This will increase the customer's outstanding balance.")) return;
    try {
        const { error } = await db.from('customer_payments').delete().eq('id', paymentId);
        if (error) throw error;
        if (custLedgerCurrentCustomer) {
            loadCustomerLedger(custLedgerCurrentCustomer.phone, custLedgerCurrentCustomer.name);
        }
    } catch (err) {
        console.error("Error deleting payment:", err);
        alert("Could not delete this payment: " + err.message);
    }
}

// --- PERIOD STOCK MOVEMENT REPORT ---
let movementProductInfoCache = {};
let movementCurrentRange = null; // { from, to, label } — lets refreshCurrentTab() restore the view

function formatDateInput(d) {
    return d.toISOString().split('T')[0];
}

function setMovementPreset(preset) {
    const now = new Date();
    let from, to, label;

    if (preset === 'this_month') {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = now;
        label = 'This Month';
    } else if (preset === 'last_month') {
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0); // last day of previous month
        label = 'Last Month';
    } else if (preset === 'this_year') {
        from = new Date(now.getFullYear(), 0, 1);
        to = now;
        label = 'This Year';
    } else { // all_time
        from = new Date(2000, 0, 1);
        to = now;
        label = 'All Time';
    }

    document.getElementById("movement-from-date").value = formatDateInput(from);
    document.getElementById("movement-to-date").value = formatDateInput(to);
    loadStockMovementReport(from, to, label);
}

function applyMovementCustomRange() {
    const fromVal = document.getElementById("movement-from-date").value;
    const toVal = document.getElementById("movement-to-date").value;
    if (!fromVal || !toVal) {
        alert("Please choose both a From and To date.");
        return;
    }
    loadStockMovementReport(new Date(fromVal), new Date(toVal), 'Custom Range');
}

async function loadStockMovementReport(from, to, label) {
    const tbody = document.getElementById("movement-report-table");
    const tfoot = document.getElementById("movement-report-totals");
    const labelEl = document.getElementById("movement-period-label");
    if (!tbody) return;

    // Normalize to full-day boundaries so the range is inclusive of both ends
    const periodStart = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0);
    const periodEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59);

    movementCurrentRange = { from: periodStart, to: periodEnd, label };
    if (labelEl) labelEl.innerText = `Showing: ${label} (${periodStart.toLocaleDateString()} – ${periodEnd.toLocaleDateString()})`;
    tbody.innerHTML = `<tr><td colspan="10" style="padding:15px; text-align:center; color:#718096;">Loading...</td></tr>`;
    tfoot.innerHTML = '';

    try {
        const [{ data: allPurchases, error: purchErr }, { data: allDeliveredOrders, error: ordErr }, { data: allProducts, error: prodErr }] = await Promise.all([
            db.from('purchases').select('*'),
            db.from('orders').select('*').eq('fulfillment_status', 'Delivered'),
            db.from('products').select('id, name, product_code')
        ]);
        if (purchErr) throw purchErr;
        if (ordErr) throw ordErr;
        if (prodErr) throw prodErr;

        const productInfoById = {};
        (allProducts || []).forEach(p => { productInfoById[p.id] = p; });
        movementProductInfoCache = productInfoById;

        // Per-product buckets: value/qty that happened BEFORE the period (for
        // Opening balance) and value/qty that happened WITHIN the period.
        const movement = {}; // productId -> { openQty, openValue, purQty, purValue, saleQty, saleValue }
        const ensure = (id) => {
            if (!movement[id]) movement[id] = { openQty: 0, openValue: 0, purQty: 0, purValue: 0, saleQty: 0, saleValue: 0 };
            return movement[id];
        };

        (allPurchases || []).forEach(p => {
            const pid = p.product_id;
            if (!pid) return;
            const qty = p.qty_received || 0;
            const value = qty * parseFloat(p.purchase_unit_cost || 0);
            const date = new Date(p.purchase_date || p.invoice_date);
            const bucket = ensure(pid);

            if (date < periodStart) {
                bucket.openQty += qty;
                bucket.openValue += value;
            } else if (date <= periodEnd) {
                bucket.purQty += qty;
                bucket.purValue += value;
            }
        });

        (allDeliveredOrders || []).forEach(o => {
            const date = new Date(o.delivered_at || o.created_at);
            const items = o.order_items_json || [];
            items.forEach(item => {
                const pid = item.product && item.product.id;
                if (!pid) return;
                const qty = item.qty || 0;
                const invoicePrice = parseFloat(item.product.deal_price || item.product.price || 0);
                const value = qty * invoicePrice;
                const bucket = ensure(pid);

                if (date < periodStart) {
                    bucket.openQty -= qty;
                    bucket.openValue -= value;
                } else if (date <= periodEnd) {
                    bucket.saleQty += qty;
                    bucket.saleValue += value;
                }
            });
        });

        // Only products with actual purchase or sale activity within the period
        const activeRows = Object.keys(movement)
            .map(pid => ({ pid: parseInt(pid, 10), ...movement[pid] }))
            .filter(r => r.purQty !== 0 || r.saleQty !== 0);

        if (activeRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="padding:15px; text-align:center; color:#718096;">No purchase or delivered-sale activity in this period.</td></tr>`;
            return;
        }

        activeRows.sort((a, b) => {
            const nameA = (productInfoById[a.pid] && productInfoById[a.pid].name) || '';
            const nameB = (productInfoById[b.pid] && productInfoById[b.pid].name) || '';
            return nameA.localeCompare(nameB);
        });

        let totals = { openQty: 0, openValue: 0, purQty: 0, purValue: 0, saleQty: 0, saleValue: 0, closeQty: 0, closeValue: 0 };

        tbody.innerHTML = activeRows.map(r => {
            const info = productInfoById[r.pid] || {};
            const closeQty = r.openQty + r.purQty - r.saleQty;
            const closeValue = r.openValue + r.purValue - r.saleValue;

            totals.openQty += r.openQty; totals.openValue += r.openValue;
            totals.purQty += r.purQty; totals.purValue += r.purValue;
            totals.saleQty += r.saleQty; totals.saleValue += r.saleValue;
            totals.closeQty += closeQty; totals.closeValue += closeValue;

            return `
                <tr style="border-bottom:1px solid #edf2f7;">
                    <td style="padding:7px 6px; font-weight:600; cursor:pointer; color:#3182ce;" onclick="jumpToProductLedger(${r.pid})">${info.name || 'Unknown Product'}</td>
                    <td style="padding:7px 6px; color:#718096;">${info.product_code || '-'}</td>
                    <td style="padding:7px 6px; text-align:right;">${r.openQty}</td>
                    <td style="padding:7px 6px; text-align:right;">K ${r.openValue.toFixed(2)}</td>
                    <td style="padding:7px 6px; text-align:right; color:#0baf65;">${r.purQty || ''}</td>
                    <td style="padding:7px 6px; text-align:right; color:#0baf65;">${r.purValue ? 'K ' + r.purValue.toFixed(2) : ''}</td>
                    <td style="padding:7px 6px; text-align:right; color:#3182ce;">${r.saleQty || ''}</td>
                    <td style="padding:7px 6px; text-align:right; color:#3182ce;">${r.saleValue ? 'K ' + r.saleValue.toFixed(2) : ''}</td>
                    <td style="padding:7px 6px; text-align:right; font-weight:bold;">${closeQty}</td>
                    <td style="padding:7px 6px; text-align:right; font-weight:bold;">K ${closeValue.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        tfoot.innerHTML = `
            <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #cbd5e0;">
                <td colspan="2" style="padding:10px 6px;">Totals (${activeRows.length} product${activeRows.length === 1 ? '' : 's'})</td>
                <td style="padding:10px 6px; text-align:right;">${totals.openQty}</td>
                <td style="padding:10px 6px; text-align:right;">K ${totals.openValue.toFixed(2)}</td>
                <td style="padding:10px 6px; text-align:right; color:#0baf65;">${totals.purQty}</td>
                <td style="padding:10px 6px; text-align:right; color:#0baf65;">K ${totals.purValue.toFixed(2)}</td>
                <td style="padding:10px 6px; text-align:right; color:#3182ce;">${totals.saleQty}</td>
                <td style="padding:10px 6px; text-align:right; color:#3182ce;">K ${totals.saleValue.toFixed(2)}</td>
                <td style="padding:10px 6px; text-align:right;">${totals.closeQty}</td>
                <td style="padding:10px 6px; text-align:right; color:#0baf65;">K ${totals.closeValue.toFixed(2)}</td>
            </tr>
        `;
    } catch (err) {
        console.error("Error loading stock movement report:", err);
        tbody.innerHTML = `<tr><td colspan="10" style="padding:15px; text-align:center; color:red;">Failed to load report.</td></tr>`;
    }
}

// --- BI ANALYTICS DASHBOARD ---
async function loadBIDashboard() {
    try {
        // Delivered only — matches P&L Report's logic exactly, so both reports
        // agree, and cancelled/in-progress orders (which haven't actually
        // resulted in completed revenue) don't inflate these numbers.
        const { data: orders, error: orderErr } = await db.from('orders').select('total_amount, order_items_json').eq('fulfillment_status', 'Delivered');
        if (orderErr) console.error("Orders fetch error:", orderErr.message);

        const { count: customerCount, error: custErr } = await db.from('customers').select('*', { count: 'exact', head: true });
        if (custErr) console.error("Customers fetch error:", custErr.message);
        
        let totalSales = 0;
        let totalOrderCount = orders ? orders.length : 0;
        let productTracker = {};

        if (orders) {
            orders.forEach(o => {
                totalSales += parseFloat(o.total_amount || 0);
                
                const items = o.order_items_json || [];
                items.forEach(item => {
                    const prod = item.product || {};
                    const pid = prod.id || item.product_id || 0;
                    const qty = item.qty || 1;
                    const revenue = (parseFloat(prod.deal_price || prod.price || 0)) * qty;
                    
                    if (!productTracker[pid]) {
                        productTracker[pid] = {
                            name: prod.name || 'Unknown Product',
                            brand: prod.brand || 'General',
                            unitsSold: 0,
                            revenue: 0
                        };
                    }
                    productTracker[pid].unitsSold += qty;
                    productTracker[pid].revenue += revenue;
                });
            });
        }

        const avgOrderValue = totalOrderCount > 0 ? (totalSales / totalOrderCount) : 0;

        document.getElementById('bi-total-sales').innerText = `K ${totalSales.toFixed(2)}`;
        document.getElementById('bi-total-orders').innerText = totalOrderCount;
        document.getElementById('bi-aov').innerText = `K ${avgOrderValue.toFixed(2)}`;
        document.getElementById('bi-customers').innerText = customerCount || 0;

        const topProducts = Object.values(productTracker).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
        const tbody = document.getElementById('bi-top-products');
        
        if (topProducts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding: 15px; text-align: center; color: #718096;">No sales data available yet.</td></tr>';
        } else {
            tbody.innerHTML = topProducts.map(tp => `
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px; font-weight: 600; color: #2d3748;">${tp.name}</td>
                    <td style="padding: 10px; color: #718096;">${tp.brand}</td>
                    <td style="padding: 10px; text-align: center; font-weight: bold; color: #3182ce;">${tp.unitsSold}</td>
                    <td style="padding: 10px; text-align: right; color: #0baf65; font-weight: bold;">K ${tp.revenue.toFixed(2)}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error("Error loading BI dashboard:", err);
    }
}

// --- PROFIT & LOSS REPORT ---
// --- PROFIT & LOSS REPORT ---
async function loadPnLReport() {
    try {
        const { data: orders, error } = await db.from('orders').select('total_amount, order_items_json').eq('fulfillment_status', 'Delivered');
        if (error) throw error;

        let totalRevenue = 0;
        let totalCOGS = 0;

        if (orders) {
            orders.forEach(o => {
                // Use the official order total amount to match the BI dashboard logic
                totalRevenue += parseFloat(o.total_amount || 0);
                
                const items = o.order_items_json || [];
                items.forEach(item => {
                    const prod = item.product || {};
                    const historicalCost = parseFloat(prod.cost_price || 0);
                    const qty = item.qty || 1;
                    totalCOGS += (historicalCost * qty);
                });
            });
        }

        const grossProfit = totalRevenue - totalCOGS;
        const grossMarginPct = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100) : 0;

        document.getElementById('pnl-revenue').innerText = `K ${totalRevenue.toFixed(2)}`;
        document.getElementById('pnl-cogs').innerText = `(K ${totalCOGS.toFixed(2)})`;
        
        const profitEl = document.getElementById('pnl-profit');
        profitEl.innerText = `K ${grossProfit.toFixed(2)}`;
        profitEl.style.color = grossProfit >= 0 ? '#0baf65' : '#e53e3e';

        document.getElementById('pnl-margin').innerText = `${grossMarginPct.toFixed(2)}%`;

    } catch (err) {
        console.error("Error loading P&L:", err);
    }
}
// --- BANNERS ---
async function loadAdminBanners() {
    const { data } = await db.from('banners').select('*').order('id', { ascending: false });
    const container = document.getElementById("admin-banners-list");
    if (!data || !container) return;
    container.innerHTML = data.map(b => {
        const added = b.times_added || 0;
        const ordered = b.times_ordered || 0;
        const rate = added > 0 ? Math.round((ordered / added) * 100) : 0;
        return `
        <div style="border:1px solid #e2e8f0; padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>${b.title}</strong><br><small>${b.subtitle || ''}</small>
                <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">
                    <span style="background:#ebf8ff; color:#2b6cb0; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold;">🛒 Added: ${added}</span>
                    <span style="background:#e6f7f0; color:#0baf65; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold;">✅ Ordered: ${ordered}</span>
                    <span style="background:#f7fafc; color:#4a5568; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold;">Conversion: ${rate}%</span>
                </div>
            </div>
            <button type="button" onclick="deleteBanner(${b.id})" style="background:#e53e3e; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Delete</button>
        </div>
    `}).join('');

    loadSavedComboPerformance();
}

async function loadSavedComboPerformance() {
    const container = document.getElementById("admin-saved-combos-performance");
    if (!container) return;

    try {
        const { data, error } = await db.from('customer_combos')
            .select('combo_name, customer_phone, times_added, times_ordered')
            .order('times_added', { ascending: false })
            .limit(15);
        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color:#718096; font-size:0.85rem;">No customer-saved combos yet.</p>';
            return;
        }

        container.innerHTML = `
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                <thead>
                    <tr style="background:#f7fafc; border-bottom:2px solid #e2e8f0; color:#4a5568;">
                        <th style="padding:8px 10px;">Combo Name</th>
                        <th style="padding:8px 10px;">Customer</th>
                        <th style="padding:8px 10px; text-align:center;">Added</th>
                        <th style="padding:8px 10px; text-align:center;">Ordered</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(c => `
                        <tr style="border-bottom:1px solid #edf2f7;">
                            <td style="padding:8px 10px; font-weight:600;">${c.combo_name}</td>
                            <td style="padding:8px 10px; color:#718096;">${c.customer_phone}</td>
                            <td style="padding:8px 10px; text-align:center;">${c.times_added || 0}</td>
                            <td style="padding:8px 10px; text-align:center;">${c.times_ordered || 0}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error("Error loading saved combo performance:", err);
        container.innerHTML = '<p style="color:red; font-size:0.85rem;">Failed to load — if this is a new feature, run the latest db-migration.sql first.</p>';
    }
}

async function deleteBanner(id) {
    await db.from('banners').delete().eq('id', id);
    loadAdminBanners();
}

// --- NOTIFICATIONS: RESTOCK REQUESTS & DELIVERY REMINDER OPT-INS ---
async function loadStockRequests() {
    const tbody = document.getElementById("admin-stock-requests-table");
    if (!tbody) return;

    try {
        const { data: requests, error } = await db
            .from('stock_notifications')
            .select('*, products(name, product_code, stock_qty)')
            .order('created_at', { ascending: false });
        if (error) throw error;

        if (!requests || requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 15px; text-align: center; color: #718096;">No restock requests yet.</td></tr>';
            return;
        }

        tbody.innerHTML = requests.map(r => {
            const reqDate = r.created_at ? new Date(r.created_at).toLocaleDateString() : '-';
            const prod = r.products || {};
            const backInStock = (prod.stock_qty || 0) > 0;
            const statusBadge = r.notified
                ? `<span style="background:#e6f7f0; color:#0baf65; padding:2px 8px; border-radius:4px; font-weight:bold;">Notified</span>`
                : (backInStock
                    ? `<span style="background:#fffaf0; color:#975a16; padding:2px 8px; border-radius:4px; font-weight:bold;">Back in stock — pending</span>`
                    : `<span style="background:#fed7d7; color:#c53030; padding:2px 8px; border-radius:4px; font-weight:bold;">Still out of stock</span>`);

            return `
                <tr style="border-bottom:1px solid #edf2f7;">
                    <td style="padding:9px; color:#4a5568;">${reqDate}</td>
                    <td style="padding:9px; font-weight:600;">${prod.name || 'Unknown product'} <small style="color:#718096;">(${prod.product_code || '-'})</small></td>
                    <td style="padding:9px;">${r.phone_number}</td>
                    <td style="padding:9px; text-align:center;">${statusBadge}</td>
                    <td style="padding:9px; text-align:center;">
                        ${!r.notified ? `<button type="button" onclick="markStockRequestNotified(${r.id})" style="background:#0baf65; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem;">Mark Notified</button>` : ''}
                        <button type="button" onclick="deleteStockRequest(${r.id})" style="background:#e53e3e; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem; margin-left:4px;">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error loading stock requests:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 15px; text-align: center; color: red;">Failed to load restock requests. If this table doesn't exist yet, run the provided db-migration.sql in Supabase first.</td></tr>`;
    }
}

async function markStockRequestNotified(id) {
    await db.from('stock_notifications').update({ notified: true }).eq('id', id);
    loadStockRequests();
}

async function deleteStockRequest(id) {
    if (!confirm("Delete this restock request?")) return;
    await db.from('stock_notifications').delete().eq('id', id);
    loadStockRequests();
}

async function loadReminderOptIns() {
    const tbody = document.getElementById("admin-reminder-optins-table");
    if (!tbody) return;

    try {
        const { data: customers, error } = await db
            .from('customers')
            .select('title, first_name, last_name, phone_number, default_office')
            .eq('wants_delivery_reminder', true);
        if (error) throw error;

        if (!customers || customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="padding: 15px; text-align: center; color: #718096;">No customers have opted in yet.</td></tr>';
            return;
        }

        tbody.innerHTML = customers.map(c => `
            <tr style="border-bottom:1px solid #edf2f7;">
                <td style="padding:9px; font-weight:600;">${c.title || ''} ${c.first_name || ''} ${c.last_name || ''}</td>
                <td style="padding:9px;">${c.phone_number}</td>
                <td style="padding:9px; color:#4a5568;">${c.default_office || '-'}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("Error loading reminder opt-ins:", err);
        tbody.innerHTML = `<tr><td colspan="3" style="padding: 15px; text-align: center; color: red;">Failed to load opt-ins. If the "wants_delivery_reminder" column doesn't exist yet, run the provided db-migration.sql in Supabase first.</td></tr>`;
    }
}

// --- FULFILLMENT ORDERS ---
async function loadAdminOrders() {
    const { data: orders } = await db.from('orders').select('*').order('id', { ascending: false });
    const { data: customers } = await db.from('customers').select('*');
    
    const customerMap = {};
    if (customers) {
        customers.forEach(c => { customerMap[c.phone_number] = c; });
    }

    const tbody = document.getElementById("admin-orders-table");
    if (!orders || !tbody) return;

    tbody.innerHTML = orders.map(o => {
        const orderDate = o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
        const orderNum = o.order_number || (`#ORD-${o.id}`);
        
        const cust = customerMap[o.customer_phone] || {};
        const customerName = `${cust.title || ''} ${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Valued Shopper';
        const items = o.order_items_json || [];

        return `
            <tr style="border-bottom:1px solid #edf2f7; background: #fff;">
                <td style="padding:10px; font-weight: bold; color: #2d3748;">#${o.id}</td>
                <td style="padding:10px; color: #4a5568; white-space: nowrap;">${orderDate}</td>
                <td style="padding:10px;">
                    <button type="button" onclick="toggleOrderDetails(${o.id})" style="background: #ebf8ff; color: #2b6cb0; border: 1px solid #bee3f8; padding: 4px 8px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.8rem;">
                        📋 ${orderNum} ▾
                    </button>
                    ${o.has_stock_issue ? `<br><button type="button" onclick="resolveStockIssue(${o.id})" title="Click once the item shortage has been sorted" style="margin-top: 4px; background: #fffaf0; color: #975a16; border: 1px solid #f6d78e; padding: 3px 6px; border-radius: 6px; font-size: 0.68rem; font-weight: bold; cursor: pointer;">⚠️ Stock Issue — Mark Resolved</button>` : ''}
                </td>
                <td style="padding:10px;">
                    <strong>${customerName}</strong><br>
                    <small style="color: #718096;">📱 ${o.customer_phone || '-'}</small><br>
                    <small style="color: #e53e3e;">📍 ${o.delivery_location || '-'}</small>
                </td>
                <td style="padding:10px;">
                    <strong style="color: #0baf65;">K ${parseFloat(o.total_amount).toFixed(2)}</strong><br>
                    <small style="color: #4a5568;">${o.payment_method || 'Mobile Money'} (${o.payment_status || 'Pending'})</small>
                </td>
                <td style="padding:10px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <select id="status-${o.id}" style="padding: 4px; font-size: 0.75rem;">
                            <option value="Order Placed" ${o.fulfillment_status === 'Order Placed' ? 'selected' : ''}>Order Placed</option>
                            <option value="Aggregating" ${o.fulfillment_status === 'Aggregating' ? 'selected' : ''}>Aggregating</option>
                            <option value="Dispatched" ${o.fulfillment_status === 'Dispatched' ? 'selected' : ''}>Dispatched</option>
                            <option value="Delivered" ${o.fulfillment_status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="Cancelled" ${o.fulfillment_status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                        <button type="button" onclick="updateFulfillmentStatus(${o.id})" style="background: #0baf65; color: white; border: none; padding: 5px 10px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.75rem;">
                            Save
                        </button>
                    </div>
                </td>
            </tr>
            <tr id="details-row-${o.id}" style="display: none; background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <td colspan="6" style="padding: 14px; text-align: center;">
                    <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; max-width: 650px; margin: 0 auto; text-align: left;">
                        <h4 style="margin: 0 0 8px 0; font-size: 0.82rem; color: #2d3748;">📦 Order Breakdown (${items.length} items)</h4>
                        <table style="width: 100%; font-size: 0.78rem; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 1px solid #edf2f7; text-align: left; color: #718096;">
                                    <th style="padding: 4px;">Product Name</th>
                                    <th style="padding: 4px;">Code</th>
                                    <th style="padding: 4px; text-align: center;">Qty</th>
                                    <th style="padding: 4px; text-align: right;">Unit Price</th>
                                    <th style="padding: 4px; text-align: right;">Total Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(item => {
                                    const p = item.product || {};
                                    const price = parseFloat(p.deal_price || p.price || 0);
                                    const totalVal = price * (item.qty || 1);
                                    return `
                                        <tr style="border-bottom: 1px solid #f7fafc;">
                                            <td style="padding: 5px 4px; font-weight: 600;">${p.name || 'Item'}</td>
                                            <td style="padding: 5px 4px; color: #718096;">${p.product_code || '-'}</td>
                                            <td style="padding: 5px 4px; text-align: center;">${item.qty || 1}</td>
                                            <td style="padding: 5px 4px; text-align: right;">K ${price.toFixed(2)}</td>
                                            <td style="padding: 5px 4px; text-align: right; font-weight: bold; color: #0baf65;">K ${totalVal.toFixed(2)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function resolveStockIssue(orderId) {
    const { error } = await db.from('orders').update({ has_stock_issue: false }).eq('id', orderId);
    if (error) {
        alert("Could not clear the flag: " + error.message);
    } else {
        loadAdminOrders();
    }
}

function toggleOrderDetails(orderId) {
    const row = document.getElementById(`details-row-${orderId}`);
    if (row) {
        row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    }
}

async function updateFulfillmentStatus(orderId) {
    const selectEl = document.getElementById(`status-${orderId}`);
    if (!selectEl) return;

    const newStatus = selectEl.value;

    // Fetch the order first: need its previous status and stock_restored flag
    // to figure out which direction (if any) stock needs to move, plus its
    // items in case a stock change is actually needed.
    const { data: existingOrder, error: fetchErr } = await db.from('orders').select('*').eq('id', orderId).single();
    if (fetchErr || !existingOrder) {
        alert("Could not load this order before updating it: " + (fetchErr ? fetchErr.message : "not found"));
        return;
    }

    const wasCancelled = existingOrder.fulfillment_status === 'Cancelled';
    const isNowCancelled = newStatus === 'Cancelled';

    // Going INTO Cancelled: restore stock (only if not already restored)
    const needsRestock = isNowCancelled && !wasCancelled && !existingOrder.stock_restored;
    // Coming OUT of Cancelled into any active status: re-deduct the stock that
    // was given back, so reactivating a cancelled order doesn't leave a
    // permanent phantom surplus (this is exactly the case that flipping
    // Cancelled → Delivered would otherwise create).
    const needsRededuct = !isNowCancelled && wasCancelled && existingOrder.stock_restored;

    // Only stamp delivered_at on the actual transition into Delivered — not
    // on every re-save while it's already sitting at Delivered, so the
    // timestamp reflects the real first delivery moment.
    const updatePayload = { fulfillment_status: newStatus };
    if (newStatus === 'Delivered' && existingOrder.fulfillment_status !== 'Delivered') {
        updatePayload.delivered_at = new Date().toISOString();
    }

    const { data, error } = await db
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .select();
    
    if (error) {
        alert("Database Error: " + error.message);
        return;
    } else if (!data || data.length === 0) {
        alert("Update blocked! Check your Supabase RLS policies for the 'orders' table.");
        return;
    }

    let stockNote = '';
    const items = existingOrder.order_items_json || [];

    if (needsRestock) {
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
        if (restoreFailures.length === 0) {
            await db.from('orders').update({ stock_restored: true }).eq('id', orderId);
            stockNote = " Stock was automatically restored for every item in this order.";
        } else {
            stockNote = ` Stock could NOT be automatically restored for: ${restoreFailures.join(', ')} — please adjust it manually.`;
        }
    } else if (needsRededuct) {
        const dedFailures = [];
        for (const item of items) {
            const prodId = item.product && item.product.id;
            if (!prodId) continue;
            const { data: currentP } = await db.from('products').select('stock_qty').eq('id', prodId).single();
            const newStock = ((currentP && currentP.stock_qty) || 0) - (item.qty || 1);
            const { error: dedErr } = await db.from('products').update({ stock_qty: newStock }).eq('id', prodId);
            if (dedErr) {
                console.error(`Could not re-deduct stock for "${item.product.name}":`, dedErr);
                dedFailures.push(item.product.name);
            }
        }
        if (dedFailures.length === 0) {
            await db.from('orders').update({ stock_restored: false }).eq('id', orderId);
            stockNote = " This order was previously cancelled (and its stock restored) — since you've reactivated it, that stock has been deducted again.";
        } else {
            stockNote = ` Could NOT re-deduct stock for: ${dedFailures.join(', ')} — please adjust it manually.`;
        }
    }

    alert(`Order #${orderId} fulfillment status updated to "${newStatus}" successfully!${stockNote}`);
    loadAdminOrders();
    loadStockHoldings();
}
