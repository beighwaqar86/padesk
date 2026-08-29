const SUPABASE_URL = "https://cziefuaclocpwicwjprb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j_MkiOlGUZOBsR8TSxIM1w_pnQ_B1xx";
let db;

window.onload = function() {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    fetchAdminProducts();
};

async function fetchAdminProducts() {
    const { data: products } = await db.from('products').select('*').order('id', { ascending: false });
    const tbody = document.getElementById("admin-product-rows");
    
    tbody.innerHTML = (products || []).map(p => `
        <tr>
            <td><strong>${p.product_code || '-'}</strong></td>
            <td>${p.name}</td>
            <td>K ${parseFloat(p.price).toFixed(2)} ${p.deal_price ? `<br><small style="color:green">Deal: K${parseFloat(p.deal_price).toFixed(2)}</small>` : ''}</td>
            <td>${p.category || '-'} ➔ ${p.sub_category || '-'}</td>
            <td>${p.brand || '-'}</td>
            <td>${p.source || '-'}</td>
            <td>
                <button onclick='deleteProduct(${p.id})' style="color:red; background:none; border:none; cursor:pointer;">🗑️ Delete</button>
            </td>
        </tr>
    `).join('');
}

async function saveProduct(event) {
    event.preventDefault();
    const payload = {
        product_code: document.getElementById("prod-code").value,
        name: document.getElementById("prod-name").value,
        price: parseFloat(document.getElementById("prod-price").value),
        deal_price: document.getElementById("prod-deal-price").value ? parseFloat(document.getElementById("prod-deal-price").value) : null,
        category: document.getElementById("prod-category").value,
        sub_category: document.getElementById("prod-subcategory").value,
        brand: document.getElementById("prod-brand").value,
        source: document.getElementById("prod-source").value,
        image_url: document.getElementById("prod-image").value
    };

    const { error } = await db.from('products').insert([payload]);
    if (error) {
        alert("Error saving product: " + error.message);
    } else {
        alert("Product saved successfully!");
        document.getElementById("product-form").reset();
        fetchAdminProducts();
    }
}

async function deleteProduct(id) {
    if (confirm("Delete this product from master?")) {
        await db.from('products').delete().eq('id', id);
        fetchAdminProducts();
    }
}
