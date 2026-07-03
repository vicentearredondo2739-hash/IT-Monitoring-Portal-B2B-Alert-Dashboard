// ==========================================
// Autenticación — IT Monitoring Portal
// Conecta con el backend PHP en /api/login.php
// ==========================================

let _captchaResult = 0;

function generateCaptcha() {
    const useAdd = Math.random() > 0.4;
    let a, b;
    if (useAdd) {
        a = Math.floor(Math.random() * 15) + 1;
        b = Math.floor(Math.random() * 15) + 1;
        _captchaResult = a + b;
        document.getElementById('captchaQuestion').innerText = a + ' + ' + b;
    } else {
        a = Math.floor(Math.random() * 10) + 10;
        b = Math.floor(Math.random() * 9) + 1;
        _captchaResult = a - b;
        document.getElementById('captchaQuestion').innerText = a + ' - ' + b;
    }
    document.getElementById('captchaAnswer').value = '';
}

document.getElementById('refreshCaptcha').addEventListener('click', generateCaptcha);
generateCaptcha();

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorBox = document.getElementById('errorMsg');
    const submitBtn = document.getElementById('submitBtn');

    // Validate CAPTCHA before hitting the server
    const captchaVal = parseInt(document.getElementById('captchaAnswer').value);
    if (isNaN(captchaVal) || captchaVal !== _captchaResult) {
        errorBox.classList.remove('hidden');
        errorBox.querySelector('span:nth-child(2)').innerText = 'Verificación de seguridad incorrecta. Intenta de nuevo.';
        generateCaptcha();
        return;
    }

    // UI Loading State
    errorBox.classList.add('hidden');
    submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> <span>Verificando...</span>';
    submitBtn.disabled = true;

    try {
        const response = await fetch('api/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const authData = await response.json();

        if (authData.success) {
            // Guardar perfil del usuario en localStorage
            localStorage.setItem('itm_portal_user', JSON.stringify(authData.user));

            // Redirigir según el rol
            if (authData.user.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'alertas-dashboard.html';
            }
        } else {
            errorBox.classList.remove('hidden');
            errorBox.querySelector('span:nth-child(2)').innerText = authData.error || "Usuario o contraseña incorrectos.";
            resetButton();
        }

    } catch (error) {
        console.error('Error de conexión:', error);
        errorBox.classList.remove('hidden');
        errorBox.querySelector('span:nth-child(2)').innerText = "Error de conexión al servidor.";
        resetButton();
    }

    function resetButton() {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Establecer Enlace</span><span class="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">login</span>';
    }
});
