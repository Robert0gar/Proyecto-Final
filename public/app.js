let cart = [];
let total = 0;
let currentUser = null;
let currentRole = null;
let isViewingAdminPanel = false;

// Manejo del Login
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

// Inicializar sesión según rol
function initUserSession() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    document.getElementById('user-display').textContent = `Usuario: ${currentUser} (${currentRole})`;

    const toggleBtn = document.getElementById('view-toggle-btn');

    if (currentRole === 'administrador') {
        toggleBtn.classList.remove('hidden');
        showAdminDashboard(); // El admin entra directo a ver reportes
    } else {
        toggleBtn.classList.add('hidden');
        showPOSView(); // El cajero entra directo a cobrar
    }
}

// Alternar entre POS y Dashboard para Admin
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
}

async function showAdminDashboard() {
    isViewingAdminPanel = true;
    document.getElementById('pos-view').classList.add('hidden');
    document.getElementById('admin-view').classList.remove('hidden');
    document.getElementById('view-toggle-btn').textContent = "Ir a Caja Registradora";
    
    await fetchSalesReports();
}

// Agregar al carrito
function addToCart(name, price) {
    cart.push({ name, price });
    total += price;
    renderCart();
}

// Renderizar carrito
function renderCart() {
    const cartContainer = document.getElementById('cart-items');
    const totalSpan = document.getElementById('cart-total');

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p class="empty-cart">No hay productos agregados</p>';
    } else {
        cartContainer.innerHTML = cart.map(item => `
            <div class="cart-item">
                <span>${item.name}</span>
                <span>$${item.price.toFixed(2)}</span>
            </div>
        `).join('');
    }

    totalSpan.textContent = total.toFixed(2);
}

// Cobrar e enviar al servidor
async function checkout() {
    if (cart.length === 0) {
        alert('Agrega al menos un producto al carrito');
        return;
    }

    try {
        const response = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: cart,
                total: total,
                cashier: currentUser
            })
        });

        if (response.ok) {
            alert(`¡Venta procesada con éxito!\nTotal cobrado: $${total.toFixed(2)}`);
            cart = [];
            total = 0;
            renderCart();
        } else {
            alert('Error al procesar la venta en el servidor');
        }
    } catch (err) {
        alert('Error de conexión al guardar la venta');
    }
}

// Consultar datos de reportes para el Admin
async function fetchSalesReports() {
    try {
        const response = await fetch('/api/sales');
        const data = await response.json();
        const sales = data.sales || [];

        let revenue = 0;
        let productCounts = {};

        const tableBody = document.getElementById('tickets-table-body');

        if (sales.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No se han registrado ventas.</td></tr>';
            document.getElementById('total-revenue').textContent = '$0.00';
            document.getElementById('total-tickets').textContent = '0';
            document.getElementById('top-product').textContent = '---';
            return;
        }

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

        // Calcular el producto más vendido
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

// Cerrar sesión
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.clear();
    location.reload();
});