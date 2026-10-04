function goHome() {
    window.location.href = "oindex.html";
}
// cart storage
let cart = JSON.parse(localStorage.getItem("cart")) || [];

/* ========= ADD TO CART ========= */

function addToCart(name, price) {

    let days = prompt("Enter rental days:", 1);

    if (!days || days <= 0) {
        alert("Invalid rental days!");
        return;
    }

    const product = {
        id: Date.now(),
        name: name,
        price: price,
        days: parseInt(days)
    };

    cart.push(product);

    localStorage.setItem("cart", JSON.stringify(cart));

    alert(name + " added to bookings!");
}


/* ========= SHOW CART COUNT ========= */

function updateCartCount() {

    const cartDiv = document.querySelector(".cart");

    if (cartDiv) {
        cartDiv.innerHTML = `📅 My Bookings (${cart.length})`;
    }
}

updateCartCount();


/* ========= LOAD CART PAGE ========= */

function loadCart() {

    const container = document.getElementById("cart-items");
    if (!container) return;

    container.innerHTML = "";

    let total = 0;

    cart.forEach(item => {

        const cost = item.price * item.days;
        total += cost;

        container.innerHTML += `
            <div class="product-card">
                <h3>${item.name}</h3>
                <p>₹${item.price} × ${item.days} days</p>
                <p><b>Total: ₹${cost}</b></p>
                <button onclick="removeItem(${item.id})">
                    Remove
                </button>
            </div>
        `;
    });

    document.getElementById("totalPrice").innerText =
        "Grand Total: ₹" + total;
}


/* ========= REMOVE ITEM ========= */

function removeItem(id) {

    cart = cart.filter(item => item.id !== id);

    localStorage.setItem("cart", JSON.stringify(cart));

    loadCart();
    updateCartCount();
}


/* ========= VIRTUAL TRY ON CAMERA ========= */

function startCamera() {

    const video = document.getElementById("camera");

    if (!video) return;

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
        })
        .catch(err => {
            alert("Camera access denied");
        });
}
