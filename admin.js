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

    // Trigger data loading based on active tab
    if (tabName === 'dashboard') {
        loadBIDashboard();
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
    if (tabName === 'notifications') {
        loadStockRequests();
        loadReminderOptIns();
    }
    if (tabName === 'lists') {
        loadBusinessMaster();
        loadBrandMaster();
    }
    if (tabName === 'ledger') {
        loadLedgerProductList();
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

    try {
        // Build/reuse a phone → name lookup so Sale rows can show a customer name
        if (Object.keys(ledgerCustomerNameByPhone).length === 0) {
            const { data: customers } = await db.from('customers').select('phone_number, title, first_name, last_name');
            (customers || []).forEach(c => {
                ledgerCustomerNameByPhone[c.phone_number] = `${c.title || ''} ${c.first_name || ''} ${c.last_name || ''}`.trim();
            });
        }

        const [{ data: purchases, error: purchErr }, { data: deliveredOrders, error: ordErr }, { data: liveProduct }] = await Promise.all([
            db.from('purchases').select('*').eq('product_id', productId),
            db.from('orders').select('*').eq('fulfillment_status', 'Delivered'),
            db.from('products').select('stock_qty').eq('id', productId).single()
        ]);
        if (purchErr) throw purchErr;
        if (ordErr) throw ordErr;

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
                    date: o.created_at,
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
        reconEl.innerHTML = `
            <div style="background: ${mismatch ? '#fffaf0' : '#e6f7f0'}; border: 1px solid ${mismatch ? '#f6d78e' : '#b2f5ea'}; border-radius: 8px; padding: 12px 16px; font-size: 0.82rem; color: ${mismatch ? '#975a16' : '#0baf65'};">
                <strong>Ledger Balance Qty:</strong> ${balQty} &nbsp;|&nbsp; <strong>Live Stock Qty:</strong> ${liveStock}
                ${mismatch
                    ? `<br><span style="color:#975a16;">These differ — usually because this product has orders placed but not yet marked <strong>Delivered</strong> (stock was already deducted at checkout, but this ledger only records sales once delivered). If there are no such pending orders for this product, the difference may indicate a manual stock edit outside the normal Purchases flow.</span>`
                    : `<br><span>Ledger and live stock agree.</span>`
                }
            </div>
        `;
    } catch (err) {
        console.error("Error loading product ledger:", err);
        tbody.innerHTML = `<tr><td colspan="11" style="padding:15px; text-align:center; color:red;">Failed to load ledger data.</td></tr>`;
    }
}

// --- BI ANALYTICS DASHBOARD ---
async function loadBIDashboard() {
    try {
        const { data: orders, error: orderErr } = await db.from('orders').select('total_amount, order_items_json');
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
    
    const { data, error } = await db
        .from('orders')
        .update({ fulfillment_status: newStatus })
        .eq('id', orderId)
        .select();
    
    if (error) {
        alert("Database Error: " + error.message);
    } else if (!data || data.length === 0) {
        alert("Update blocked! Check your Supabase RLS policies for the 'orders' table.");
    } else {
        alert(`Order #${orderId} fulfillment status updated to "${newStatus}" successfully!`);
        loadAdminOrders();
    }
}
