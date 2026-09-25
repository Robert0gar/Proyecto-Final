let cart = []; // Estructura: [{ id, name, price, qty }]
let total = 0;
let currentUser = null;
let currentRole = null;
let isViewingAdminPanel = false;
let globalProductsList = [];

// ==========================================================================
// PANTALLA EMERGENTE PERSONALIZADA (MODAL REEMPLAZO DE ALERT)
// ==========================================================================
function showCustomAlert(message, title = 'Notificación', icon = '💡') {
    const alertModal = document.getElementById('custom-alert-modal');
    const alertTitle = document.getElementById('alert-title');
    const alertMsg = document.getElementById('alert-message');
    const alertIcon = document.getElementById('alert-icon');

    if (alertModal && alertTitle && alertMsg && alertIcon) {
        alertTitle.textContent = title;
        alertMsg.textContent = message;
        alertIcon.textContent = icon;
        alertModal.classList.remove('hidden');
    } else {
        alert(message);
    }
}

function closeCustomAlert() {
    const alertModal = document.getElementById('custom-alert-modal');
    if (alertModal) {
        alertModal.classList.add('hidden');
    }
}

// ==========================================================================
// CARGAR PRODUCTOS DESDE LA BASE DE DATOS
// ==========================================================================
async function loadProductsFromDB() {
    try {
        const response = await fetch('/api/products');
        globalProductsList = await response.json();
        
        const container = document.getElementById('products-container');
        if (container) {
            container.innerHTML = globalProductsList.map(prod => `
                <button class="product-card ${prod.stock <= 0 ? 'out-of-stock' : ''}" 
                        onclick="addToCart(${prod.id})" 
                        ${prod.stock <= 0 ? 'disabled' : ''}>
                    <div class="product-img-container">
                        <img src="${prod.image || 'images/default-bread.png'}" alt="${prod.name}" class="product-img">
                    </div>
                    <h3>${prod.name}</h3>
                    <p>$${prod.price.toFixed(2)}</p>
                    <small class="stock-tag">${prod.stock > 0 ? `Stock: ${prod.stock}` : 'AGOTADO'}</small>
                </button>
            `).join('');
        }

        populateRefillSelect();
        populateWasteSelect();
    } catch (err) {
        console.error('Error cargando catálogo desde la BD:', err);
    }
}

// ==========================================================================
// CARRITO DE COMPRAS CON EDICIÓN Y ELIMINACIÓN
// ==========================================================================
function addToCart(productId) {
    const id = parseInt(productId);
    const product = globalProductsList.find(p => p.id === id);
    
    if (!product) {
        console.error('Producto no encontrado:', productId);
        return;
    }

    const cartItem = cart.find(item => item.id === id);
    const currentQtyInCart = cartItem ? cartItem.qty : 0;

    if (currentQtyInCart >= product.stock) {
        showCustomAlert(
            `Solo hay ${product.stock} piezas disponibles de "${product.name}".`, 
            'Stock Insuficiente', 
            '⚠️'
        );
        return;
    }

    if (cartItem) {
        cartItem.qty += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            qty: 1
        });
    }

    recalculateTotal();
    renderCart();
}

function updateCartQty(productId, change) {
    const id = parseInt(productId);
    const cartItem = cart.find(item => item.id === id);
    const product = globalProductsList.find(p => p.id === id);

    if (!cartItem) return;

    if (change > 0 && product) {
        if (cartItem.qty >= product.stock) {
            showCustomAlert(
                `No puedes agregar más. Stock disponible: ${product.stock}`, 
                'Límite de Stock', 
                '⚠️'
            );
            return;
        }
        cartItem.qty += 1;
    } else if (change < 0) {
        cartItem.qty -= 1;
        if (cartItem.qty <= 0) {
            removeFromCart(id);
            return;
        }
    }

    recalculateTotal();
    renderCart();
}

function removeFromCart(productId) {
    const id = parseInt(productId);
    cart = cart.filter(item => item.id !== id);
    recalculateTotal();
    renderCart();
}

function clearCart() {
    if (cart.length === 0) return;
    cart = [];
    total = 0;
    renderCart();
}

function recalculateTotal() {
    total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

function renderCart() {
    const cartContainer = document.getElementById('cart-items');
    const totalSpan = document.getElementById('cart-total');

    if (!cartContainer || !totalSpan) return;

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p class="empty-cart">No hay productos agregados</p>';
    } else {
        cartContainer.innerHTML = `
            <div class="cart-header-actions">
                <button class="btn-clear-cart" onclick="clearCart()">🗑️ Vaciar Carrito</button>
            </div>
        ` + cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <span class="cart-item-title">${item.name}</span>
                    <span class="cart-item-unit-price">$${item.price.toFixed(2)} c/u</span>
                </div>
                <div class="cart-item-controls">
                    <button class="btn-qty" onclick="updateCartQty(${item.id}, -1)">-</button>
                    <span class="cart-item-qty">${item.qty}</span>
                    <button class="btn-qty" onclick="updateCartQty(${item.id}, 1)">+</button>
                    <span class="cart-item-subtotal">$${(item.price * item.qty).toFixed(2)}</span>
                    <button class="btn-remove-item" onclick="removeFromCart(${item.id})" title="Cancelar este pan">❌</button>
                </div>
            </div>
        `).join('');
    }

    totalSpan.textContent = total.toFixed(2);
}

async function checkout() {
    if (cart.length === 0) {
        showCustomAlert('Agrega al menos un producto al carrito.', 'Carrito Vacío', '🛒');
        return;
    }

    // Convertir el carrito agrupado a la lista plana requerida por el backend si es necesario
    const flatItems = [];
    cart.forEach(item => {
        for (let i = 0; i < item.qty; i++) {
            flatItems.push({ id: item.id, name: item.name, price: item.price });
        }
    });

    try {
        const response = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: flatItems,
                total: total,
                cashier: currentUser || 'Cajero'
            })
        });

        const data = await response.json();

        if (response.ok) {
            showCustomAlert(
                `Venta registrada con éxito.\nTotal cobrado: $${total.toFixed(2)}`, 
                '¡Venta Realizada!', 
                '🎉'
            );
            cart = [];
            total = 0;
            renderCart();
            await loadProductsFromDB();
        } else {
            showCustomAlert(data.message || 'Error al procesar la venta.', 'Error', '❌');
        }
    } catch (err) {
        console.error('Error en checkout:', err);
        showCustomAlert('Error de conexión al guardar la venta.', 'Error de Conexión', '🌐');
    }
}

// ==========================================================================
// DESPLEGABLES DE FORMULARIOS
// ==========================================================================
function populateRefillSelect() {
    const select = document.getElementById('select-product-refill');
    if (!select) return;

    if (globalProductsList.length === 0) {
        select.innerHTML = '<option value="">No hay productos disponibles</option>';
        return;
    }

    select.innerHTML = '<option value="">-- Selecciona un pan --</option>' + 
        globalProductsList.map(prod => `
            <option value="${prod.id}">${prod.emoji || '🥐'} ${prod.name} (Stock actual: ${prod.stock})</option>
        `).join('');
}

function populateWasteSelect() {
    const select = document.getElementById('select-product-waste');
    if (!select) return;

    if (globalProductsList.length === 0) {
        select.innerHTML = '<option value="">No hay productos disponibles</option>';
        return;
    }

    select.innerHTML = '<option value="">-- Selecciona un pan --</option>' + 
        globalProductsList.map(prod => `
            <option value="${prod.id}">${prod.emoji || '🥐'} ${prod.name} (Stock actual: ${prod.stock})</option>
        `).join('');
}

// ==========================================================================
// AUTENTICACIÓN Y SESIÓN
// ==========================================================================
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const usernameInput = document.getElementById('username').value;
    const passwordInput = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = data.username;
            currentRole = data.role;

            localStorage.setItem('jwtToken', data.token);
            localStorage.setItem('userRole', data.role);
            localStorage.setItem('username', data.username);

            initUserSession();
        } else {
            errorDiv.textContent = data.message || 'Error en el inicio de sesión';
        }
    } catch (err) {
        errorDiv.textContent = 'No se pudo conectar con el servidor backend';
    }
});

function initUserSession() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    document.getElementById('user-display').textContent = `Usuario: ${currentUser} (${currentRole})`;

    loadProductsFromDB();

    const toggleBtn = document.getElementById('view-toggle-btn');
    if (currentRole === 'administrador') {
        toggleBtn.classList.remove('hidden');
        showAdminDashboard();
    } else {
        toggleBtn.classList.add('hidden');
        showPOSView();
    }
}

function toggleAdminView() {
    if (isViewingAdminPanel) {
        showPOSView();
    } else {
        showAdminDashboard();
    }
}

function showPOSView() {
    isViewingAdminPanel = false;
    document.getElementById('pos-view').classList.remove('hidden');
    document.getElementById('admin-view').classList.add('hidden');
    document.getElementById('view-toggle-btn').textContent = "Ver Reportes Admin";
    loadProductsFromDB();
}

async function showAdminDashboard() {
    isViewingAdminPanel = true;
    document.getElementById('pos-view').classList.add('hidden');
    document.getElementById('admin-view').classList.remove('hidden');
    document.getElementById('view-toggle-btn').textContent = "Ir a Caja Registradora";
    
    await loadProductsFromDB();
    await fetchSalesReports();
    await fetchProfitabilityMatrix();
    await fetchProductionRecommendations();
}

// ==========================================================================
// REPORTES Y MÓDULOS DE DECISIÓN (DSS)
// ==========================================================================
async function fetchSalesReports() {
    try {
        const response = await fetch('/api/sales');
        const data = await response.json();
        const sales = data.sales || [];

        let revenue = 0;
        let productCounts = {};

        const tableBody = document.getElementById('tickets-table-body');

        if (sales.length === 0) {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay ventas hoy.</td></tr>';
            document.getElementById('total-revenue').textContent = '$0.00';
            document.getElementById('total-tickets').textContent = '0';
            document.getElementById('top-product').textContent = '---';
            return;
        }

        if (tableBody) {
            tableBody.innerHTML = sales.map(sale => {
                revenue += sale.total;
                
                const itemList = sale.items.map(i => {
                    productCounts[i.name] = (productCounts[i.name] || 0) + 1;
                    return i.name;
                }).join(', ');

                return `
                    <tr>
                        <td>#${sale.id}</td>
                        <td>${sale.date}</td>
                        <td>${sale.cashier}</td>
                        <td>${itemList}</td>
                        <td><strong>$${sale.total.toFixed(2)}</strong></td>
                    </tr>
                `;
            }).join('');
        }

        let topProd = '---';
        let maxQty = 0;
        for (const [prod, qty] of Object.entries(productCounts)) {
            if (qty > maxQty) {
                maxQty = qty;
                topProd = `${prod} (${qty})`;
            }
        }

        document.getElementById('total-revenue').textContent = `$${revenue.toFixed(2)}`;
        document.getElementById('total-tickets').textContent = sales.length;
        document.getElementById('top-product').textContent = topProd;

    } catch (err) {
        console.error('Error al obtener reportes:', err);
    }
}

async function fetchProfitabilityMatrix() {
    const tableBody = document.getElementById('profitability-matrix-body');
    if (!tableBody) return;

    try {
        const response = await fetch('/api/reports/profitability-matrix');
        const data = await response.json();

        if (data.success && data.matrix.length > 0) {
            tableBody.innerHTML = data.matrix.map(item => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; font-weight: bold;">${item.name}</td>
                    <td style="padding: 10px; color: #28a745; font-weight: bold;">${item.total_sold} pzas</td>
                    <td style="padding: 10px; color: #dc3545; font-weight: bold;">${item.total_wasted} pzas</td>
                    <td style="padding: 10px;">
                        <span style="background: ${item.badge_color}; color: #fff; padding: 4px 8px; border-radius: 12px; font-size: 0.85em; font-weight: bold;">
                            ${item.classification}
                        </span>
                    </td>
                    <td style="padding: 10px; font-size: 0.9em; color: #555;">${item.action_note}</td>
                </tr>
            `).join('');
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 15px;">Sin datos suficientes para generar la matriz.</td></tr>';
        }
    } catch (err) {
        console.error('Error al cargar matriz de rentabilidad:', err);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: red;">Error al cargar diagnóstico.</td></tr>';
    }
}

async function fetchProductionRecommendations() {
    const tableBody = document.getElementById('recommendations-table-body');
    if (!tableBody) return;

    try {
        const response = await fetch('/api/reports/production-recommendation');
        const data = await response.json();

        if (data.success && data.recommendations.length > 0) {
            tableBody.innerHTML = data.recommendations.map(item => `
                <tr>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.category}</td>
                    <td>${item.current_stock} pzas</td>
                    <td>${item.total_sold} pzas</td>
                    <td><span style="color: red; font-weight: bold;">${item.total_wasted} pzas</span></td>
                    <td>${item.avg_daily_sales} /día</td>
                    <td><strong>🔥 Hornear ${item.recommended_baking} pzas</strong></td>
                    <td><span style="color: ${item.alert_color}; font-weight: bold;">${item.status}</span></td>
                </tr>
            `).join('');
        } else {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No hay suficiente información para generar predicciones.</td></tr>';
        }
    } catch (err) {
        console.error('Error al obtener recomendaciones de producción:', err);
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: red;">Error al cargar predicciones.</td></tr>';
    }
}

// ==========================================================================
// ACCIONES DE REABASTECIMIENTO Y MERMA
// ==========================================================================
document.getElementById('refill-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const productId = document.getElementById('select-product-refill').value;
    const stock = parseInt(document.getElementById('refill-stock-qty').value);

    try {
        const response = await fetch('/api/products/refill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, stock })
        });

        const data = await response.json();

        if (response.ok) {
            showCustomAlert(data.message, '¡Inventario Actualizado!', '🥖');
            document.getElementById('refill-product-form').reset();
            await loadProductsFromDB();
            await fetchProfitabilityMatrix();
            await fetchProductionRecommendations();
        } else {
            showCustomAlert(data.message || 'Error al surtir el producto.', 'Error', '❌');
        }
    } catch (err) {
        showCustomAlert('Error de conexión al actualizar el inventario.', 'Error de Conexión', '🌐');
    }
});

const wasteForm = document.getElementById('waste-product-form');
if (wasteForm) {
    wasteForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const productId = document.getElementById('select-product-waste').value;
        const quantity = parseInt(document.getElementById('waste-qty').value);
        const reason = document.getElementById('waste-reason').value;

        try {
            const response = await fetch('/api/waste', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, quantity, reason })
            });

            const data = await response.json();

            if (response.ok) {
                showCustomAlert(data.message, 'Merma Registrada', '🗑️');
                wasteForm.reset();
                await loadProductsFromDB();
                await fetchProfitabilityMatrix();
                await fetchProductionRecommendations();
            } else {
                showCustomAlert(data.message || 'Error al registrar la merma.', 'Error', '❌');
            }
        } catch (err) {
            showCustomAlert('Error de conexión al guardar la merma.', 'Error de Conexión', '🌐');
        }
    });
}

// ==========================================================================
// CORTE DE DÍA Y CIERRE
// ==========================================================================
async function closeDay() {
    if (!confirm('¿Estás seguro de finalizar la jornada? Se generará el corte del día.')) return;

    try {
        const response = await fetch('/api/sales/close-day', { method: 'POST' });
        const data = await response.json();

        if (response.ok) {
            const summary = data.summary;
            document.getElementById('modal-revenue').textContent = summary.totalRevenue.toFixed(2);
            document.getElementById('modal-tickets').textContent = summary.totalTickets;

            const listContainer = document.getElementById('modal-product-list');
            const entries = Object.entries(summary.productSummary);

            if (entries.length === 0) {
                listContainer.innerHTML = '<li><em>Sin ventas registradas en esta jornada.</em></li>';
            } else {
                listContainer.innerHTML = entries
                    .map(([prod, qty]) => `<li>• <strong>${prod}</strong>: ${qty} piezas vendidas</li>`)
                    .join('');
            }

            document.getElementById('close-day-modal').classList.remove('hidden');
        } else {
            showCustomAlert(data.message, 'Atención', '⚠️');
        }
    } catch (err) {
        showCustomAlert('Error al cerrar el día.', 'Error', '❌');
    }
}

function dismissModal() {
    document.getElementById('close-day-modal').classList.add('hidden');
    fetchSalesReports();
    fetchProfitabilityMatrix();
    fetchProductionRecommendations();
}

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.clear();
    location.reload();
});